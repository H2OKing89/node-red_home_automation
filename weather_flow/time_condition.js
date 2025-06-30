/**
 * Node-RED Function: Time Restriction and Event Bypass for Notifications
 *
 * Description:
 *  - Restricts notifications to be sent between 07:00 and 22:00 in America/Chicago.
 *  - Bypasses time restrictions for "Tornado Warning" events.
 *  - Uses Moment.js for reliable timezone handling.
 *  - Fully configurable via global context or node properties.
 *
 * Version: 1.1.1
 * Author: Quentin (patched)
 * Date: 05/21/2025
 *
 * Changelog:
 *  v1.1.1 - Switched to America/Chicago timezone; added global context config;
 *           improved error handling and logging levels.
 *  v1.1.0 - Added error handling, timezone support, and configurability.
 *  v1.0.0 - Initial version.
 *
 * Dependencies:
 *  - moment and moment-timezone installed and available via global.get('moment')
 */

// === Configuration ===
// Suggestion: validate that retrieved globals are of expected type/format
const config = {
    timezone: global.get('NOTIF_TIMEZONE') || 'America/Chicago',
    startHour: Number(global.get('NOTIF_START_HOUR')) || 7,        // Ensure numeric
    endHour: Number(global.get('NOTIF_END_HOUR')) || 22,           // Ensure numeric
    bypassEvent: 'Tornado Warning'
};

// Helper: get moment with timezone once
let momentLib;
try {
    momentLib = global.get('moment');
    if (!momentLib?.tz) {
        throw new Error('Moment-timezone not available');
    }
} catch (err) {
    node.error(`Timezone library missing: ${err.message}`);
}

// Extract alerts array safely (consider caching path lookup if high throughput)
const alerts = msg.data?.event?.new_state?.attributes?.Alerts;
if (!Array.isArray(alerts) || alerts.length === 0) {
    node.warn('No alerts found; message blocked.');
    return null;
}
const eventName = alerts[0].Event;  // Consider destructuring for clarity

// Determine current hour in configured timezone
let currentHour;
if (momentLib) {
    currentHour = momentLib().tz(config.timezone).hour();
} else {
    currentHour = new Date().getHours();
    node.warn('Using local server time; timezone may be incorrect.');
}

// Bypass or restrict notification
try {
    // Suggestion: compare eventName in a case-insensitive manner if data varies
    if (eventName === config.bypassEvent) {
        node.log('Bypass event detected; sending message regardless of time.');
        return msg;
    }
    // Suggestion: combine conditions or use a lookup table for future bypass events
    if (currentHour >= config.startHour && currentHour < config.endHour) {
        node.log(`Within allowed window (${config.startHour}-${config.endHour}); currentHour=${currentHour}.`);
        return msg;
    }
    node.debug(`Blocked: outside allowed hours. currentHour=${currentHour}.`);
    return null;
} catch (err) {
    // Suggestion: enrich error context with eventName and currentHour
    node.error(`Error processing time restriction: ${err.message}`);
    return null;
}
