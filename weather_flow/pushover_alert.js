/**
 * Node-RED Function: Weather Alert → Pushover Notification
 * Version: 2.0.2
 * Author: Quentin
 * Date: 2025-05-21
 *
 * Enhancements:
 * - Alert validation & schema checking
 * - Dynamic emoji & weather art fallback
 * - Cached Intl.DateTimeFormat instances
 * - Helper functions: URL builder, HTML composer, date formatting
 * - Simplified bullet formatting, truncation
 * - Sound selection based on severity & priority
 * - Improved, standardized logging
 */

// --------------------------------------------------------------------------
// 0) Fail-fast on unexpected payloads
// --------------------------------------------------------------------------
if (!Array.isArray(msg.payload) && typeof msg.payload !== 'object') {
    node.warn('Unexpected payload type – aborting');
    return null;
}

// --------------------------------------------------------------------------
// 0a) Alert validation & schema checking
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
// 0b) Dynamic emoji & weather art fallback
// --------------------------------------------------------------------------
const dynamicEmojiMap = {
    tornado: "🌪️", flood: "🌊", thunderstorm: "⛈️", snow: "❄️",
    rain: "🌧️", wind: "💨", severe: "⛈️", moderate: "🌦️",
    minor: "🌤️", default: "ℹ️"
};
function getDynamicEmoji(alert) {
    const name = (alert.Event || '').toLowerCase();
    for (const key in dynamicEmojiMap) {
        if (key !== 'default' && name.includes(key)) {
            return dynamicEmojiMap[key];
        }
    }
    const sev = (alert.Severity || '').toLowerCase();
    for (const key of ['severe', 'moderate', 'minor']) {
        if (sev.includes(key)) {
            return dynamicEmojiMap[key];
        }
    }
    return dynamicEmojiMap.default;
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
// 2) Build static (or dynamic) URL
// --------------------------------------------------------------------------
function buildStaticURL(zoneid = 'NEZ066') {
    return `https://forecast.weather.gov/MapClick.php?zoneid=${zoneid}`;
}

// --------------------------------------------------------------------------
// 3a) Message length validation for Pushover limits
// --------------------------------------------------------------------------
function truncateToLimit(text, maxChars = 1024) {
    if (text.length <= maxChars) return text;
    
    // Simple character-based truncation with safe margin for UTF-8
    const safeLimit = maxChars - 20; // Leave margin for UTF-8 multi-byte chars
    return text.substring(0, safeLimit) + '...';
}

function validatePushoverLimits(title, message, url = '') {
    const limits = {
        title: 247,      // 250 - 3 for '...'
        message: 1000,   // 1024 - 24 for safety margin and '...'
        url: 509         // 512 - 3 for safety
    };
    
    return {
        title: title.length > limits.title ? title.substring(0, limits.title) + '...' : title,
        message: truncateToLimit(message, limits.message),
        url: url.length > limits.url ? url.substring(0, limits.url) : url
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
// 4) Compose HTML message
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
        const targetCounties = ['Lancaster', 'Sarpy', 'Saunders', 'Seward'];
        const areas = alert.AreasAffected.split(/[;,]/)
            .map(area => area.trim())
            .filter(area => targetCounties.some(county => area.includes(county) && area.includes('NE')))
            .join(', ');
        
        if (areas) {
            msg += `<br><br><strong>📍 Affected Areas:</strong><br>${areas}`;
        }
    }    // Add description (filtered to remove Iowa content and area listings)
    if (alert.Description) {
        let desc = alert.Description;
        
        // Extract just the essential information, removing geographic listings
        desc = desc.replace(/IN IOWA THIS WATCH INCLUDES[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
                  .replace(/IN SOUTHWEST IOWA[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
                  .replace(/IN WEST CENTRAL IOWA[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
                  .replace(/IN NEBRASKA THIS WATCH INCLUDES[\s\S]*?(?=THIS INCLUDES THE CITIES|$)/gi, '')
                  .replace(/IN \w+ NEBRASKA[\s\S]*?(?=THIS INCLUDES THE CITIES|IN \w+ NEBRASKA|$)/gi, '')
                  .replace(/THIS INCLUDES THE CITIES OF[\s\S]*$/gi, '')
                  .replace(/\s+/g, ' ')
                  .trim();
        
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
// 5) Sound selection
// --------------------------------------------------------------------------
function getSound(severity, priority) {
    const sev = (severity || '').toLowerCase();
    if (priority === 2) return 'siren';
    if (sev.includes('severe')) return 'bugle';
    if (sev.includes('moderate')) return 'magic';
    return 'pushover';
}

// --------------------------------------------------------------------------
// 6) Pushover config
// --------------------------------------------------------------------------
const cfg = global.get('pushoverTokens') || {};
const userKeys = global.get('pushoverUserKeys') || {};
if (!cfg.adminToken || !userKeys.quentinUserKey) {
    node.error('[CONFIG_ERROR] Missing Pushover tokens or user key');
    return null;
}

// --------------------------------------------------------------------------
// 7) Priority map
// --------------------------------------------------------------------------
const priorityMap = { 2: { level: 2, retry: 30, expire: 7200 }, 1: { level: 1 }, 0: { level: 0 } };

// --------------------------------------------------------------------------
// 8) Static event→emoji map
// --------------------------------------------------------------------------
const eventEmojiMap = {
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
};

// --------------------------------------------------------------------------
// 9) Main logic
// --------------------------------------------------------------------------
const alertsRaw = msg.data?.event?.new_state?.attributes?.Alerts;
if (!Array.isArray(alertsRaw) || alertsRaw.length === 0) {
    node.warn('[ALERT] No alert data available');
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
        if (!eventName) throw new Error("Missing 'Event' field");        const emoji = eventEmojiMap[eventName] || getDynamicEmoji(alert);
        const title = `${emoji} Weather Alert: ${eventName} ${emoji}`;
        const htmlBody = composeHTMLMessage(alert);
        const soundName = getSound(alert.Severity, priority);
        const pMap = priorityMap[priority] || priorityMap[0];

        // Validate and truncate message to fit Pushover limits
        const validated = validatePushoverLimits(title, htmlBody, buildStaticURL(alert.ZoneID));

        const msgPayload = {
            token: cfg.adminToken, user: userKeys.quentinUserKey,
            title: validated.title, message: validated.message, html: 1, 
            sound: soundName, priority: pMap.level
        };
        if (pMap.retry) msgPayload.retry = pMap.retry;
        if (pMap.expire) msgPayload.expire = pMap.expire;

        node.log(`[ALERT_OK] idx=${idx}, Event=${eventName}, prio=${pMap.level}, sound=${soundName}, msgLen=${validated.message.length}`);
        outputMsgs.push({ payload: msgPayload });
    }
    catch (err) {
        node.error(`[ALERT_ERROR] idx=${idx}, Error: ${err.message}`);
    }
});

node.log(`[ALERT_DONE] Processed ${outputMsgs.length} alert(s)`);
return outputMsgs;
