/**
 * Node-RED Function: Weather Alert → Pushover Notification
 * Version: 2.2.0
 * Author: Quentin
 * Date: October 4, 2025
 *
 * Changelog v2.2.0:
 * - Added structured logging with timestamps
 * - Refactored geographic filtering to config-driven approach
 * - Added context tracking for sent alert history
 * - Consolidated config objects for better organization
 * - Added cleanup handler for consistency
 * - Improved error handling and status reporting
 *
 * Changelog v2.1.0:
 * - Added node.status() updates, node.done() calls, enhanced error handling
 *   with msg object for Node-RED best practices
 * - Alert validation & schema checking
 * - Dynamic emoji & weather art fallback
 * - Cached Intl.DateTimeFormat instances
 * - Helper functions: URL builder, HTML composer, date formatting
 * - Simplified bullet formatting, truncation
 * - Sound selection based on severity & priority
 * - Improved, standardized logging
 *
 * IMPORTANT: Set Function timeout in Node-RED Setup tab (NR >= 3.1)
 * Recommended: 10-15 seconds for notification processing
 * 
 * OPTIONAL: Consider adding 'date-fns' via Function External Modules
 * for enhanced date formatting and timezone handling instead of Intl.DateTimeFormat
 */

// --------------------------------------------------------------------------
// 0) Configuration & Logging
// --------------------------------------------------------------------------
const LOGGING_ENABLED = true; // Set to false to disable detailed logging

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

// Configuration object
const config = {
    geographic: {
        targetCounties: ['Lancaster', 'Sarpy', 'Saunders', 'Seward'],
        targetState: 'NE',
        targetStateName: 'Nebraska',
        excludeStates: ['Iowa', 'Kansas', 'Missouri', 'South Dakota']
    },
    emoji: {
        dynamic: {
            tornado: "🌪️", flood: "🌊", thunderstorm: "⛈️", snow: "❄️",
            rain: "🌧️", wind: "💨", severe: "⛈️", moderate: "🌦️",
            minor: "🌤️", default: "ℹ️"
        },
        eventMap: {
            "Tornado Warning": "🌪️", "Rip Current Statement": "🏊", "Extreme Wind Warning": "💨",
            "Blizzard Warning": "❄️", "Severe Thunderstorm Warning": "⛈️", "Flash Flood Warning": "🌊",
            "Earthquake Warning": "💥", "Evacuation Immediate": "🚨", "Fire Warning": "🔥",
            "Radiological Hazard Warning": "☢️", "Nuclear Power Plant Warning": "☢️",
            "Shelter in Place Warning": "🏠", "Civil Danger Warning": "🚨",
            "Hazardous Materials Warning": "☣️", "Law Enforcement Warning": "👮",
            "Child Abduction Emergency": "🚨", "Flood Warning": "🌊", "High Wind Warning": "💨",
            "Winter Storm Warning": "🌨️", "Severe Thunderstorm Watch": "⛈️", "Tornado Watch": "🌪️",
            "Blue Alert": "🔵", "Civil Emergency Message": "🚨", "Local Area Emergency": "🚨",
            "911 Telephone Outage Emergency": "📞", "Flash Flood Watch": "🌊", "Flood Watch": "🌊",
            "Winter Storm Watch": "🌨️", "High Wind Watch": "💨", "Special Weather Statement": "ℹ️",
            "Severe Weather Statement": "ℹ️", "Severe Thunderstorm Statement": "⛈️",
            "Flood Statement": "🌊", "Tornado Statement": "🌪️", "Flash Flood Statement": "🌊",
            "Freeze Warning": "🥶", "Red Flag Warning": "🚩", "Earthquake Statement": "💥"
        }
    },
    priority: {
        2: { level: 2, retry: 30, expire: 7200 },
        1: { level: 1 },
        0: { level: 0 }
    },
    pushover: {
        limits: {
            title: 247,      // 250 - 3 for '...'
            message: 1000,   // 1024 - 24 for safety margin and '...'
            url: 509         // 512 - 3 for safety
        }
    }
};

// --------------------------------------------------------------------------
// 0a) Fail-fast on unexpected payloads
// --------------------------------------------------------------------------
if (!Array.isArray(msg.payload) && typeof msg.payload !== 'object') {
    logStructured('warn', 'Unexpected payload type – aborting', { payloadType: typeof msg.payload });
    node.status({ fill: 'yellow', shape: 'ring', text: 'Invalid payload' });
    node.done();
    return null;
}

// --------------------------------------------------------------------------
// 0b) Alert validation & schema checking
// --------------------------------------------------------------------------
function validateAlert(alert) {
    const required = ['Event', 'Severity', 'Sent'];
    required.forEach(field => {
        if (!(field in alert)) {
            throw new Error(`Missing required field: ${field}`);
        }
    });
    if (typeof alert.Event !== 'string' || typeof alert.Severity !== 'string') {
        throw new Error('Invalid field type for Event or Severity');
    }
}

// --------------------------------------------------------------------------
// 0c) Dynamic emoji & weather art fallback
// --------------------------------------------------------------------------
function getDynamicEmoji(alert) {
    const name = (alert.Event || '').toLowerCase();
    for (const key in config.emoji.dynamic) {
        if (key !== 'default' && name.includes(key)) {
            return config.emoji.dynamic[key];
        }
    }
    const sev = (alert.Severity || '').toLowerCase();
    for (const key of ['severe', 'moderate', 'minor']) {
        if (sev.includes(key)) {
            return config.emoji.dynamic[key];
        }
    }
    return config.emoji.dynamic.default;
}

// --------------------------------------------------------------------------
// 1) Cached date/time formatters for America/Chicago
// --------------------------------------------------------------------------
const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Chicago'
});
const timeFormatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'America/Chicago'
});
function formatDateTime(date) {
    return `${dateFormatter.format(date)}, at ${timeFormatter.format(date)}`;
}

// --------------------------------------------------------------------------
// 2) Geographic filtering helper functions
// --------------------------------------------------------------------------
function filterCountiesForNotification(areasText) {
    if (!areasText) return '';
    
    const areaList = areasText.split(/[;,]/).map(area => area.trim());
    const filteredAreas = areaList.filter(area => 
        config.geographic.targetCounties.some(county => area.includes(county)) && 
        area.includes(config.geographic.targetState)
    );
    
    return filteredAreas.join(', ');
}

function filterStateContentForNotification(description) {
    if (!description) return '';
    
    let filtered = description;
    
    // Remove excluded state sections
    config.geographic.excludeStates.forEach(state => {
        const stateUpper = state.toUpperCase();
        // Pattern: "IN [STATE] THIS WATCH INCLUDES..."
        const watchPattern = new RegExp(
            `IN ${stateUpper} THIS WATCH INCLUDES[\\s\\S]*?(?=IN ${config.geographic.targetStateName.toUpperCase()}|IN \\w+ ${config.geographic.targetStateName.toUpperCase()}|$)`,
            'gi'
        );
        filtered = filtered.replace(watchPattern, '');
        
        // Pattern: "IN [DIRECTION] [STATE]..."
        const dirPattern = new RegExp(
            `IN \\w+ ${stateUpper}[\\s\\S]*?(?=IN ${config.geographic.targetStateName.toUpperCase()}|IN \\w+ ${config.geographic.targetStateName.toUpperCase()}|$)`,
            'gi'
        );
        filtered = filtered.replace(dirPattern, '');
    });
    
    // Remove geographic area listings for target state too
    filtered = filtered.replace(
        new RegExp(`IN ${config.geographic.targetStateName.toUpperCase()} THIS WATCH INCLUDES[\\s\\S]*?(?=THIS INCLUDES THE CITIES|$)`, 'gi'),
        ''
    );
    filtered = filtered.replace(
        new RegExp(`IN \\w+ ${config.geographic.targetStateName.toUpperCase()}[\\s\\S]*?(?=THIS INCLUDES THE CITIES|IN \\w+ ${config.geographic.targetStateName.toUpperCase()}|$)`, 'gi'),
        ''
    );
    filtered = filtered.replace(/THIS INCLUDES THE CITIES OF[\s\S]*$/gi, '');
    
    return filtered.replace(/\s+/g, ' ').trim();
}

// --------------------------------------------------------------------------
// 3) Build static (or dynamic) URL
// --------------------------------------------------------------------------
function buildStaticURL(zoneid = 'NEZ066') {
    return `https://forecast.weather.gov/MapClick.php?zoneid=${zoneid}`;
}

// --------------------------------------------------------------------------
// 4) Message length validation for Pushover limits
// --------------------------------------------------------------------------
function truncateToLimit(text, maxChars = 1024) {
    if (text.length <= maxChars) return text;
    
    // Simple character-based truncation with safe margin for UTF-8
    const safeLimit = maxChars - 20; // Leave margin for UTF-8 multi-byte chars
    return text.substring(0, safeLimit) + '...';
}

function validatePushoverLimits(title, message, url = '') {
    return {
        title: title.length > config.pushover.limits.title ? 
            title.substring(0, config.pushover.limits.title) + '...' : title,
        message: truncateToLimit(message, config.pushover.limits.message),
        url: url.length > config.pushover.limits.url ? 
            url.substring(0, config.pushover.limits.url) : url
    };
}
// --------------------------------------------------------------------------
function bulletsWithLimit(text, limit) {
    if (!text) return '';
    
    // First try to split by natural line breaks
    let items = text.split(/\n+/).map(i => i.trim()).filter(i => i);
    
    // If we get one long line, try to split it intelligently
    if (items.length === 1 && items[0].length > 100) {
        const longText = items[0];
        items = [];
        
        // Split by sentence patterns and geographic sections
        const parts = longText.split(/(?:\.\s+)|(?:\s+IN\s+[A-Z\s]+NEBRASKA\s+)|(?:\s+THIS\s+INCLUDES\s+THE\s+CITIES\s+OF\s+)/i);
        
        for (let part of parts) {
            part = part.trim();
            if (part.length > 0) {
                // If still too long, split by commas or other natural breaks
                if (part.length > 120) {
                    const subParts = part.split(/,\s+(?=[A-Z])/);
                    items.push(...subParts.map(p => p.trim()).filter(p => p.length > 0));
                } else {
                    items.push(part);
                }
            }
        }
    }
    
    // Clean up items and limit
    items = items.map(i => i.replace(/^[•\-\*]\s*/, '').trim()).filter(i => i.length > 0);
    const slice = items.slice(0, limit);
    if (items.length > limit) slice.push(`…and ${items.length - limit} more sections`);
    return slice.map(i => `• ${i}`).join("<br>");
}

// --------------------------------------------------------------------------
// 5) Compose HTML message
// --------------------------------------------------------------------------
function composeHTMLMessage(alert) {
    const sev = alert.Severity || 'Unknown';
    const head = alert.Headline || 'No headline';
    const sent = alert.Sent ? formatDateTime(new Date(alert.Sent)) : formatDateTime(new Date());
    const exp = alert.Expires ? formatDateTime(new Date(alert.Expires)) : '—';

    // Build header section
    let msg = [
        `<strong>⚠️ ${sev} Alert</strong>`,
        `<strong>${head}</strong>`,
        '',
        `<em>📅 Issued:</em> ${sent}`,
        `<em>⏰ Expires:</em> ${exp}`
    ].join("<br>");

    // Add affected areas (filtered for Nebraska counties)
    if (alert.AreasAffected) {
        const areas = filterCountiesForNotification(alert.AreasAffected);
        
        if (areas) {
            msg += `<br><br><strong>📍 Affected Areas:</strong><br>${areas}`;
        }
    }
    
    // Add description (filtered to remove Iowa content and area listings)
    if (alert.Description) {
        let desc = filterStateContentForNotification(alert.Description);
        
        // Keep only the essential watch information
        if (desc) {
            // Extract key details like watch number, timing, etc.
            const watchMatch = desc.match(/(SEVERE THUNDERSTORM WATCH \d+|TORNADO WATCH \d+)/i);
            const timingMatch = desc.match(/(IN EFFECT UNTIL [^.]*|REMAINS VALID UNTIL [^.]*)/i);
            
            let essentialInfo = '';
            if (watchMatch) essentialInfo += watchMatch[1] + '. ';
            if (timingMatch) essentialInfo += timingMatch[1] + '. ';
            
            // Add any other important non-geographic information
            const otherInfo = desc.replace(/(SEVERE THUNDERSTORM WATCH \d+|TORNADO WATCH \d+)/gi, '')
                                 .replace(/(IN EFFECT UNTIL [^.]*|REMAINS VALID UNTIL [^.]*)/gi, '')
                                 .replace(/FOR THE FOLLOWING AREAS/gi, '')
                                 .trim();
            
            if (otherInfo && otherInfo.length > 10) {
                essentialInfo += otherInfo;
            }
            
            if (essentialInfo) {
                msg += `<br><br><strong>📝 Details:</strong><br>${essentialInfo}`;
            }
        }
    }

    // Add instructions
    if (alert.Instruction && alert.Instruction.trim()) {
        msg += `<br><br><strong>☑️ Instructions:</strong><br>` + bulletsWithLimit(alert.Instruction, 3);
    }

    // Add footer with link
    msg += `<br><br><a href="${buildStaticURL(alert.ZoneID)}">📱 View Full Forecast</a>`;
    
    return msg;
}

// --------------------------------------------------------------------------
// 6) Sound selection
// --------------------------------------------------------------------------
function getSound(severity, priority) {
    const sev = (severity || '').toLowerCase();
    if (priority === 2) return 'siren';
    if (sev.includes('severe')) return 'bugle';
    if (sev.includes('moderate')) return 'magic';
    return 'pushover';
}

// --------------------------------------------------------------------------
// 7) Context tracking for sent alerts
// --------------------------------------------------------------------------
function trackSentAlert(alertData) {
    const history = context.get('sent_alert_history') || [];
    const alertEntry = {
        timestamp: new Date().toISOString(),
        event: alertData.Event,
        priority: alertData.priority,
        severity: alertData.Severity,
        userKey: alertData.userKey
    };
    history.push(alertEntry);
    // Keep only last 20 alerts
    if (history.length > 20) history.shift();
    context.set('sent_alert_history', history);
    context.set('last_alert_sent', alertEntry.timestamp);
    context.set('alert_sent_count', (context.get('alert_sent_count') || 0) + 1);
}

// --------------------------------------------------------------------------
// 8) Pushover config
// --------------------------------------------------------------------------
const cfg = global.get('pushoverTokens') || {};
const userKeys = global.get('pushoverUserKeys') || {};
if (!cfg.adminToken || !userKeys.quentinUserKey) {
    logStructured('error', 'Missing Pushover tokens or user key', { 
        hasAdminToken: !!cfg.adminToken, 
        hasUserKey: !!userKeys.quentinUserKey 
    });
    node.status({ fill: 'red', shape: 'ring', text: 'Config error' });
    node.done();
    return null;
}

// --------------------------------------------------------------------------
// 9) Cleanup handler
// --------------------------------------------------------------------------
node.on('close', () => {
    logStructured('log', 'Pushover alert processor cleaned up');
});

// --------------------------------------------------------------------------
// 10) Main logic
// --------------------------------------------------------------------------
node.status({ fill: 'blue', shape: 'dot', text: 'Processing alerts...' });

const alertsRaw = msg.data?.event?.new_state?.attributes?.Alerts;
if (!Array.isArray(alertsRaw) || alertsRaw.length === 0) {
    logStructured('warn', 'No alert data available');
    node.status({ fill: 'yellow', shape: 'ring', text: 'No alerts' });
    node.done();
    return null;
}
const processed = Array.isArray(msg.payload) ? msg.payload : [msg.payload];
const outputMsgs = [];

alertsRaw.forEach((alert, idx) => {
    try {
        validateAlert(alert);
        const proc = processed[idx] || {};
        const priority = typeof proc.priority === 'number' ? proc.priority : 0;
        const eventName = alert.Event;
        if (!eventName) throw new Error("Missing 'Event' field");
        
        const emoji = config.emoji.eventMap[eventName] || getDynamicEmoji(alert);
        const title = `${emoji} Weather Alert: ${eventName} ${emoji}`;
        const htmlBody = composeHTMLMessage(alert);
        const soundName = getSound(alert.Severity, priority);
        const pMap = config.priority[priority] || config.priority[0];

        // Validate and truncate message to fit Pushover limits
        const validated = validatePushoverLimits(title, htmlBody, buildStaticURL(alert.ZoneID));

        const msgPayload = {
            token: cfg.adminToken, user: userKeys.quentinUserKey,
            title: validated.title, message: validated.message, html: 1, 
            sound: soundName, priority: pMap.level
        };
        if (pMap.retry) msgPayload.retry = pMap.retry;
        if (pMap.expire) msgPayload.expire = pMap.expire;

        // Track sent alert in context
        trackSentAlert({
            Event: eventName,
            Severity: alert.Severity,
            priority: priority,
            userKey: userKeys.quentinUserKey
        });

        logStructured('log', 'Alert processed successfully', {
            index: idx,
            event: eventName,
            priority: pMap.level,
            sound: soundName,
            messageLength: validated.message.length
        });
        
        outputMsgs.push({ payload: msgPayload });
    }
    catch (err) {
        logStructured('error', 'Alert processing failed', {
            index: idx,
            error: err.message,
            event: alert?.Event || 'unknown'
        });
        node.error(`Alert processing error at index ${idx}: ${err.message}`, msg);
    }
});

logStructured('log', 'Alert processing completed', { 
    totalAlerts: alertsRaw.length, 
    processed: outputMsgs.length 
});
node.status({ fill: 'green', shape: 'dot', text: `Sent ${outputMsgs.length} alert(s)` });
node.done();
return outputMsgs;
