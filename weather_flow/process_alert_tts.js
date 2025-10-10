/**
 * Node-RED Function: EAS and Announcement Message Handling
 * Refactored with SSML, Date Formatting & Dynamic Pauses
 *
 * Version: 2.0.0
 * Author: Quentin
 * Date: 10/06/2025
 * 
 * Changelog v2.0.0:
 * - Updated Google speaker TTS to use new tts.speak API (2025+ standard)
 * - Replaced deprecated tts.google_say with tts.speak action
 * - Added TTS service entity configuration
 * 
 * Changelog v1.9.0:
 * - Removed duplicate trackAlert() and cleanup handler definitions (bug fix)
 * - Changed from flow-scoped to context-scoped processing lock
 * - Added structured logging helper with timestamps
 * - Refactored geographic filtering into config and helper functions
 * - Added timeout protection documentation
 * - Added optional external module note for date-fns
 * 
 * Changelog v1.8.0:
 * - Added node.status() updates for visual feedback
 * - Added node.done() calls for proper async completion tracking
 * - Added context storage for alert history tracking
 * - Enhanced error handling with msg object for Catch node support
 * - Added LOGGING_ENABLED flag for optional detailed logging
 * - Added cleanup handler for node shutdown
 * - Improved logging categorization (log vs warn vs error)
 * 
 * IMPORTANT: Set Function timeout in Node-RED Setup tab (NR >= 3.1)
 * Recommended: 30-60 seconds to prevent hanging on network issues
 * 
 * OPTIONAL: Consider adding 'date-fns' via Function External Modules
 * for enhanced date formatting and timezone handling
 */

/* CONFIGURATION */
const LOGGING_ENABLED = true; // Set to false to disable detailed logging
const config = {
    devices: {
        sonos: [
            "media_player.living_room_sonos_era_100",
            "media_player.bedroom_sonos_amp",
            "media_player.sonos_1"
        ],
        google: [
            "media_player.family_room_home_mini",
            "media_player.kitchen_home_mini",
            "media_player.garage_home_mini"
        ]
    },
    ttsService: "tts.google_translate_en_com", // TTS service entity for new API
    volumes: {
        sonos: 100,
        google: 1.0
    },
    alertSounds: {
        eas: { file: "homeassistant.kingpaging.com/local/weather/eas_first_half.wav", delay: 19000 },
        weather: { file: "homeassistant.kingpaging.com/local/weather/the_weather_channel_1.mp3", delay: 5000 }
    },
    geographic: {
        targetCounties: ['Lancaster', 'Sarpy', 'Saunders', 'Seward'],
        targetState: 'NE',
        targetStateName: 'Nebraska',
        excludeStates: ['Iowa', 'Kansas', 'Missouri', 'South Dakota'],
        stateAbbreviations: { 
            NE: 'Nebraska', 
            IA: 'Iowa', 
            KS: 'Kansas', 
            MO: 'Missouri', 
            SD: 'South Dakota' 
        }
    },
    genericErrorMessage: "An error occurred while processing the weather alert. Please check the system logs."
};

/* LOGGING */
function log(message) {
    if (LOGGING_ENABLED) {
        node.log(message);
    }
}

function logStructured(level, message, data = {}) {
    if (!LOGGING_ENABLED) return;
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...data
    };
    const logFn = node[level] || node.log;
    logFn(JSON.stringify(entry));
}

/* GEOGRAPHIC FILTERING HELPERS */
function filterCounties(areasText, targetCounties, targetState) {
    if (!areasText) return '';
    
    // Split by semicolons/commas and trim
    const areaList = areasText.split(/[;,]/).map(area => area.trim());
    
    // Filter for target counties in target state
    const filteredAreas = areaList.filter(area => 
        targetCounties.some(county => area.includes(county)) && area.includes(targetState)
    );
    
    return filteredAreas.join(', ');
}

function filterStateContent(description, excludeStates, targetStateName) {
    if (!description) return '';
    
    let filtered = description;
    
    // Remove sections for excluded states
    excludeStates.forEach(state => {
        const stateUpper = state.toUpperCase();
        // Pattern: "IN [STATE] THIS WATCH INCLUDES..." up to Nebraska mention or end
        const pattern = new RegExp(
            `IN ${stateUpper} THIS WATCH INCLUDES \\d+ COUNTIES[\\s\\S]*?(?=IN ${targetStateName.toUpperCase()}|IN \\w+ ${targetStateName.toUpperCase()}|$)`,
            'gi'
        );
        filtered = filtered.replace(pattern, '');
        
        // Pattern: "IN [DIRECTION] [STATE]..." up to Nebraska or end
        const dirPattern = new RegExp(
            `IN \\w+ ${stateUpper}[\\s\\S]*?(?=IN ${targetStateName.toUpperCase()}|IN \\w+ ${targetStateName.toUpperCase()}|$)`,
            'gi'
        );
        filtered = filtered.replace(dirPattern, '');
    });
    
    // Clean up extra whitespace
    return filtered.replace(/\s+/g, ' ').trim();
}

function expandStateAbbreviations(text, abbreviations) {
    if (!text) return '';
    let expanded = text;
    Object.entries(abbreviations).forEach(([abbr, full]) => {
        const pattern = new RegExp(`\\b${abbr}\\b`, 'g');
        expanded = expanded.replace(pattern, full);
    });
    return expanded;
}

/* CONTEXT STORAGE */
function trackAlert(alertData) {
    const history = context.get('alert_history') || [];
    const alertEntry = {
        timestamp: new Date().toISOString(),
        event: alertData.event,
        priority: alertData.priority,
        areas: alertData.areas
    };
    history.push(alertEntry);
    // Keep only last 20 alerts
    if (history.length > 20) history.shift();
    context.set('alert_history', history);
    context.set('last_alert_time', alertEntry.timestamp);
    context.set('alert_count', (context.get('alert_count') || 0) + 1);
}

/* CLEANUP HANDLER */
node.on('close', function() {
    // Clear processing flag on node shutdown
    context.set('isProcessing', false);
    log('Weather alert processor cleaned up');
});

/* HELPERS */
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }
function sendWithRetry(fn, retries = 3, delayMs = 2000) {
    return fn().catch(err => {
        if (retries > 0) {
            node.warn(`Retrying... attempts left: ${retries}`);
            return delay(delayMs).then(() => sendWithRetry(fn, retries - 1, delayMs * 2));
        }
        node.error(`Failed after retries: ${err.message}`);
        throw err;
    });
}
function buildPayload(action, targets, data) { return { action, target: { entity_id: targets }, data }; }
function sendAction(action, targets, data) {
    const payload = buildPayload(action, targets, data);
    return sendWithRetry(() => new Promise((resolve, reject) => {
        try { node.send({ payload }); resolve(); }
        catch (e) { reject(e); }
    }));
}

// Validate alert object
function validateAlert(a) {
    // Only require Event, Headline, Description, and AreasAffected to be non-empty strings
    return a && typeof a === 'object' &&
        ['Event', 'Headline', 'Description', 'AreasAffected']
            .every(k => typeof a[k] === 'string' && a[k].trim());
}
// Sanitize raw text
function sanitizeText(t) {
    if (typeof t !== 'string') return '';
    return t.replace(/\*/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim();
}

/* MAIN */
(async () => {
    if (context.get('isProcessing')) { 
        log("Another event in flight, ignoring.");
        node.done();
        return; 
    }
    
    node.status({ fill: "blue", shape: "dot", text: "Processing alert..." });
    context.set('isProcessing', true);
    
    try {
        // 1) Set Google volume
        log("Setting device volumes...");
        await sendAction("media_player.volume_set", config.devices.google, { volume_level: config.volumes.google });
        
        // 2) Play alert sound
        node.status({ fill: "blue", shape: "dot", text: "Playing alert sound..." });
        const priority = Array.isArray(msg.payload) ? msg.payload[0]?.priority : msg.payload.priority;
        const allDevices = [...config.devices.sonos, ...config.devices.google];
        const soundKey = (priority <= 2) ? 'eas' : 'weather';
        const sound = config.alertSounds[soundKey];
        log(`Playing ${soundKey} alert sound on ${allDevices.length} devices`);
        await sendAction("media_player.play_media", allDevices,
            { media_content_id: `https://${sound.file}`, media_content_type: 'music' }
        ); 
        await delay(sound.delay);
        
        // 3) Fetch & validate alert
        node.status({ fill: "blue", shape: "dot", text: "Validating alert data..." });
        const rawAlerts = msg.data?.event?.new_state?.attributes?.Alerts;
        if (!Array.isArray(rawAlerts) || !validateAlert(rawAlerts[0])) {
            node.status({ fill: "yellow", shape: "ring", text: "Invalid alert - skipped" });
            node.warn('Invalid or missing alert data, skipping announcement');
            node.done();
            return;
        }
        const raw = rawAlerts[0];
        log(`Processing ${raw.Event} alert`);
        
        // 4) Sanitize fields
        const event = sanitizeText(raw.Event);
        const headline = sanitizeText(raw.Headline);
        const instr = sanitizeText(raw.Instruction);
        
        // Filter areas to only include specific Nebraska counties
        let areas = sanitizeText(raw.AreasAffected);
        areas = filterCounties(areas, config.geographic.targetCounties, config.geographic.targetState);
        areas = expandStateAbbreviations(areas, config.geographic.stateAbbreviations);
        
        // Remove Iowa sections from description
        let desc = sanitizeText(raw.Description);
        desc = filterStateContent(desc, config.geographic.excludeStates, config.geographic.targetStateName);
        
        // 5) Build plain text message
        const message = [
            `The National Weather Service has issued a ${event}.`,
            headline + '.',
            areas ? `The affected areas include ${areas}.` : '',
            desc,
            instr
        ].filter(Boolean).join(' ');
        
        // Track alert in context
        trackAlert({
            event: event,
            priority: priority,
            areas: areas
        });
        
        // 6) Sonos TTS
        node.status({ fill: "blue", shape: "dot", text: "Announcing via Sonos..." });
        log(`Announcing to ${config.devices.sonos.length} Sonos devices`);
        await sendAction("media_player.play_media", config.devices.sonos, {
            media_content_id: `media-source://tts/google_translate?message=${encodeURIComponent('"' + message + '"')}`,
            media_content_type: 'music', announce: true, extra: { volume: config.volumes.sonos }
        }); 
        await delay(1000);
        
        // 7) Google TTS (using new tts.speak API)
        node.status({ fill: "blue", shape: "dot", text: "Announcing via Google..." });
        log(`Announcing to ${config.devices.google.length} Google devices`);
        await sendWithRetry(() => new Promise((resolve, reject) => {
            try {
                node.send({ 
                    payload: {
                        action: "tts.speak",
                        target: { entity_id: config.ttsService },
                        data: {
                            cache: true,
                            media_player_entity_id: config.devices.google,
                            message: message
                        }
                    }
                });
                resolve();
            } catch (e) { reject(e); }
        }));
        
        node.status({ fill: "green", shape: "dot", text: "Announcement completed" });
        log(`Weather alert announcement completed successfully: ${event}`);
        node.done();
        
    } catch (e) {
        node.status({ fill: "red", shape: "ring", text: "Error: " + e.message });
        node.error('Processing error: ' + e.message, msg);
        logStructured('error', 'Weather alert processing failed', { error: e.message, stack: e.stack });
        const fb = config.genericErrorMessage;
        // Fallback error announcement using new TTS API
        await sendWithRetry(() => new Promise((resolve, reject) => {
            try {
                node.send({ 
                    payload: {
                        action: "tts.speak",
                        target: { entity_id: config.ttsService },
                        data: {
                            cache: false,
                            media_player_entity_id: config.devices.google,
                            message: fb
                        }
                    }
                });
                resolve();
            } catch (e) { reject(e); }
        })).catch(() => { });
        node.done();
        
    } finally {
        context.set('isProcessing', false);
    }
})();

return null;
