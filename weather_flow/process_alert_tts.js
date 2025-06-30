/**
 * Node-RED Function: EAS and Announcement Message Handling
 * Refactored with SSML, Date Formatting & Dynamic Pauses
 *
 * Version: 1.7.0
 * Author: Quentin
 * Date: 05/21/2025
 */

/* CONFIGURATION */
const config = {
    devices: {
        sonos: [
            "media_player.era_100",
            "media_player.bedroom_sonos_amp",
            "media_player.sonos_1"
        ],
        google: [
            "media_player.family_room_home_mini",
            "media_player.kitchen_home_mini",
            "media_player.garage_home_mini"
        ]
    },
    volumes: {
        sonos: 100,
        google: 1.0
    },
    alertSounds: {
        eas: { file: "homeassistant.kingpaging.com/local/weather/eas_first_half.wav", delay: 19000 },
        weather: { file: "homeassistant.kingpaging.com/local/weather/the_weather_channel_1.mp3", delay: 5000 }
    },
    genericErrorMessage: "An error occurred while processing the weather alert. Please check the system logs."
};

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
    if (flow.get('isProcessing')) { node.warn("Another event in flight, ignoring."); return; }
    flow.set('isProcessing', true);
    try {
        // 1) Set Google volume
        await sendAction("media_player.volume_set", config.devices.google, { volume_level: config.volumes.google });
        // 2) Play alert sound
        const priority = Array.isArray(msg.payload) ? msg.payload[0]?.priority : msg.payload.priority;
        const allDevices = [...config.devices.sonos, ...config.devices.google];
        const soundKey = (priority <= 2) ? 'eas' : 'weather';
        const sound = config.alertSounds[soundKey];
        await sendAction("media_player.play_media", allDevices,
            { media_content_id: `https://${sound.file}`, media_content_type: 'music' }
        ); await delay(sound.delay);
        // 3) Fetch & validate alert
        const rawAlerts = msg.data?.event?.new_state?.attributes?.Alerts;
        if (!Array.isArray(rawAlerts) || !validateAlert(rawAlerts[0])) {
            node.warn('Invalid or missing alert, skipping.'); return;
        }
        const raw = rawAlerts[0];        // 4) Sanitize fields
        const event = sanitizeText(raw.Event);
        const headline = sanitizeText(raw.Headline);
        let desc = sanitizeText(raw.Description);
        const instr = sanitizeText(raw.Instruction);
        
        // Filter areas to only include specific Nebraska counties
        const targetCounties = ['Lancaster, NE', 'Sarpy, NE', 'Saunders, NE', 'Seward, NE'];
        let areas = sanitizeText(raw.AreasAffected);
        if (areas) {
            // Split by semicolons and filter for target counties
            const areaList = areas.split(/[;,]/).map(area => area.trim());
            const filteredAreas = areaList.filter(area => 
                targetCounties.some(target => area.includes(target.replace(', NE', '')))
            );
            areas = filteredAreas.join(', ').replace(/\b[A-Z]{2}\b/g, s => ({ NE: 'Nebraska' }[s] || s));
        }
        
        // Remove Iowa sections from description
        if (desc) {
            desc = desc.replace(/IN IOWA THIS WATCH INCLUDES \d+ COUNTIES[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
                      .replace(/IN SOUTHWEST IOWA[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
                      .replace(/IN WEST CENTRAL IOWA[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
                      .replace(/\s+/g, ' ')
                      .trim();
        }
        // Filter description to focus on Nebraska content
        if (desc) {
            // Option 1: Keep only Nebraska-related sections
            const neRelevantContent = [];
            const sections = desc.split(/\n{2,}/);
            
            let inNebraskaPart = false;
            for (const section of sections) {
                // Start capturing when Nebraska is mentioned
                if (/\bNEBRASKA\b/i.test(section)) {
                    inNebraskaPart = true;
                    neRelevantContent.push(section);
                } 
                // Continue capturing while in Nebraska part (and not in other states)
                else if (inNebraskaPart && !/\b(IOWA|KANSAS|MISSOURI|SOUTH DAKOTA)\b/i.test(section)) {
                    neRelevantContent.push(section);
                }
                // Stop capturing when another state section begins
                else if (/\b(IOWA|KANSAS|MISSOURI|SOUTH DAKOTA)\b/i.test(section)) {
                    inNebraskaPart = false;
                }
            }
            
            // If we found Nebraska content, use it; otherwise, fall back to the original but remove obvious Iowa references
            if (neRelevantContent.length > 0) {
                desc = neRelevantContent.join("\n\n");
            } else {
                // Fallback: more general filtering of Iowa-related content
                desc = desc.replace(/\b(?:IN|FOR)\s+(?:THE STATE OF\s+)?IOWA\b.*?(?=\b(?:IN|FOR)\s+(?:THE STATE OF\s+)?(?:NEBRASKA|[A-Z]+)\b|$)/gis, '')
                          .replace(/\b(?:IOWA|IA)\s+(?:COUNTIES|COUNTY)\b.*?(?=\b(?:NEBRASKA|NE)\s+(?:COUNTIES|COUNTY)\b|$)/gis, '')
                          .trim();
            }
            
            // Clean up extra whitespace
            desc = desc.replace(/\s+/g, ' ').trim();
        }// 5) Build plain text message
        const message = [
            `The National Weather Service has issued a ${event}.`,
            headline + '.',
            areas ? `The affected areas include ${areas}.` : '',
            desc,
            instr
        ].filter(Boolean).join(' ');        // 6) Sonos TTS
        await sendAction("media_player.play_media", config.devices.sonos, {
            media_content_id: `media-source://tts/google_translate?message=${encodeURIComponent('"' + message + '"')}`,
            media_content_type: 'music', announce: true, extra: { volume: config.volumes.sonos }
        }); await delay(1000);
        // 7) Google TTS
        await sendAction("tts.google_say", config.devices.google, { message });
        node.log('Announcement completed.');
    } catch (e) {
        node.error('Processing error: ' + e.message);
        const fb = config.genericErrorMessage;
        await sendAction('tts.google_say', config.devices.google, { message: fb }).catch(() => { });
    } finally {
        flow.set('isProcessing', false);
    }
})();
return null;
