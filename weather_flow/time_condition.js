/**
 * Node-RED Function: Time Restriction and Event Bypass for Notifications
 *
 * Description:
 *  - Restricts notifications to be sent between 07:00 and 22:00 in America/Chicago.
 *  - Bypasses time restrictions for "Tornado Warning" events.
 *  - Uses date-fns and date-fns-tz for reliable timezone handling.
 *  - Fully configurable via global context or node properties.
 *
 * Version: 1.2.0
 * Author: Quentin (patched)
 * Date: 07/09/2025
 *
 * Changelog:
 *  v1.2.0 - Switched to date-fns/date-fns-tz for timezone handling; removed moment.
 *  v1.1.1 - Switched to America/Chicago timezone; added global context config;
 *           improved error handling and logging levels.
 *  v1.1.0 - Added error handling, timezone support, and configurability.
 *  v1.0.0 - Initial version.
 *
 * Dependencies:
 *  - date-fns and date-fns-tz available as global variables (dateFns, dateFnsTz)
 */

// === Configuration ===
// Set config statically here; edit as needed for your deployment
const config = {
    timezone: 'America/Chicago', // IANA timezone string
    startHour: 7,               // Start hour (24h format)
    endHour: 22,                // End hour (24h format)
    bypassEvent: 'Tornado Warning'
};

// Helper: get date-fns-tz utilities
let formatInTimeZone, zonedTimeToUtc;
try {
    if (!dateFnsTz?.formatInTimeZone) {
        throw new Error('date-fns-tz not available');
    }
    formatInTimeZone = dateFnsTz.formatInTimeZone;
    zonedTimeToUtc = dateFnsTz.zonedTimeToUtc;
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
if (formatInTimeZone) {
    // Use date-fns-tz to get the hour in the configured timezone
    const now = new Date();
    currentHour = Number(formatInTimeZone(now, config.timezone, 'H'));
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
