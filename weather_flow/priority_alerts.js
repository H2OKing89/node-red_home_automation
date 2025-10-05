// Node-RED Function: Enhanced Event Priority Assignment with Multiple ID Tracking,
// Payload Type Validation, and TTL-Based Duplicate Handling
//
// Description:
//  - Validates that required fields exist and are of correct types (e.g., Alerts is an array,
//    and each alert has an ID and Event as strings).
//  - Supports processing multiple alerts bundled in a single message.
//  - Implements a Time-To-Live (TTL) mechanism to automatically expire old alert entries,
//    ensuring duplicates are handled only within a specific time window.
//  - Assigns a priority to each event based on a predefined priority list.
//  - Uses granular error handling so that a malformed alert won't stop processing of others.
//
// Version: 1.6.0
// Author: Quentin
// Date: October 4, 2025
//
// Changelog:
//  v1.6.0 - Added node.status() updates, node.done() calls, enhanced error handling
//           with msg object, improved for Node-RED best practices
//  v1.5.3 - Replaced node.info() with node.log() to match Function node API.
//  v1.5.2 - Added comprehensive debug logs for tracing inputs, outputs, and state changes.
//  v1.5.1 - Removed extra arguments from flow.get and flow.set to resolve TypeScript errors.
//  v1.5.0 - Added type validation, multiple alert processing, TTL-based duplicate handling,
//           and more granular error handling.
//
// Dependencies:
//  - Moment.js for date and time formatting (used only for timestamp output).

// Configuration constants
const ALERT_TTL_MS = flow.get('alertTTL') || 3600000; // TTL for alert history entries (ms)
const MAX_STORED_ALERTS = flow.get('maxStoredAlerts') || 50; // Maximum history size

// Predefined priority lookup, hoisted to module level for performance
const eventPriorityList = {
    "Tornado Warning": 1, "Rip Current Statement": 1, "Extreme Wind Warning": 1,
    "Blizzard Warning": 1, "Severe Thunderstorm Warning": 1, "Flash Flood Warning": 1,
    "Earthquake Warning": 1, "Evacuation Immediate": 1, "Fire Warning": 1,
    "Radiological Hazard Warning": 1, "Nuclear Power Plant Warning": 1,
    "Shelter in Place Warning": 1, "Civil Danger Warning": 1,
    "Hazardous Materials Warning": 1, "Law Enforcement Warning": 1,
    "Child Abduction Emergency": 1, "Flood Warning": 2,
    "High Wind Warning": 2, "Tornado Watch": 2, "Blue Alert": 2,
    "Civil Emergency Message": 2, "Local Area Emergency": 2,
    "911 Telephone Outage Emergency": 2, "Winter Storm Warning": 3,
    "Severe Thunderstorm Watch": 3, "Flash Flood Watch": 3,
    "Flood Watch": 3, "Winter Storm Watch": 3, "High Wind Watch": 3,
    "Special Weather Statement": 3, "Severe Weather Statement": 3,
    "Severe Thunderstorm Statement": 3, "Flood Statement": 4,
    "Tornado Statement": 4, "Flash Flood Statement": 4,
    "Freeze Warning": 4, "Red Flag Warning": 4,
    "Earthquake Statement": 4
};

/**
 * Validates the overall payload structure and data types.
 * Ensures that required nested objects exist and that Alerts is an array.
 */
function validatePayload(msg) {
    node.log('validatePayload: Starting payload validation');
    node.log(`validatePayload: msg.payload type = ${typeof msg.payload}`);
    if (msg.payload === 'unavailable') {
        node.warn("Payload is 'unavailable'. Dropping the message.");
        node.status({ fill: 'yellow', shape: 'ring', text: 'Payload unavailable' });
        return false;
    }
    const alerts = msg?.data?.event?.new_state?.attributes?.Alerts;
    if (!Array.isArray(alerts)) {
        node.warn("Missing or invalid Alerts array. Dropping the message.");
        node.status({ fill: 'yellow', shape: 'ring', text: 'Invalid alerts array' });
        return false;
    }
    node.log(`validatePayload: Found ${alerts.length} alerts`);
    node.log('validatePayload: validation passed');
    return true;
}

/**
 * Processes an individual alert object.
 * Validates required fields exist and are correct types.
 */
function processAlert(alert) {
    node.log(`processAlert: Received alert item = ${JSON.stringify(alert)}`);
    if (typeof alert !== 'object' || alert === null) {
        node.warn("Alert is not a valid object. Skipping.");
        return null;
    }
    if (typeof alert.ID !== 'string' || typeof alert.Event !== 'string') {
        node.warn("Alert missing required ID or Event fields or they are not strings. Skipping.");
        return null;
    }
    node.log(`processAlert: Processing alert ID=${alert.ID}, Event=${alert.Event}`);
    return alert;
}

/**
 * Tracks the alert ID to prevent duplicate processing.
 * Removes expired entries based on TTL and checks for duplicates.
 */
function trackAlert(alertID, now) {
    node.log(`trackAlert: Checking history for ID=${alertID} at ${new Date(now).toISOString()}`);
    let alertHistory = flow.get('alertHistory') || [];
    node.log(`trackAlert: Loaded history with ${alertHistory.length} entries`);
    // Expire old entries
    alertHistory = alertHistory.filter(entry => now - entry.timestamp <= ALERT_TTL_MS);
    node.log(`trackAlert: ${alertHistory.length} entries after TTL cleanup`);
    if (alertHistory.some(entry => entry.id === alertID)) {
        node.log(`trackAlert: Duplicate detected for ID=${alertID}. Skipping.`);
        flow.set('alertHistory', alertHistory);
        return false;
    }
    alertHistory.push({ id: alertID, timestamp: now });
    node.log(`trackAlert: Added ID=${alertID} to history`);
    if (alertHistory.length > MAX_STORED_ALERTS) {
        alertHistory = alertHistory.slice(-MAX_STORED_ALERTS);
        node.log(`trackAlert: Trimmed history to ${alertHistory.length} entries`);
    }
    flow.set('alertHistory', alertHistory);
    return true;
}

/**
 * Assigns a priority to an event based on the hoisted priority list.
 */
function assignPriority(event) {
    node.log(`assignPriority: Looking up priority for event="${event}"`);
    const pr = eventPriorityList[event];
    if (pr === undefined) {
        node.warn(`Event "${event}" not in list. Default priority 5.`);
        return 5;
    }
    node.log(`assignPriority: Event="${event}", priority=${pr}`);
    return pr;
}

// -----------------------------
// Main Function Logic
// -----------------------------
try {
    node.status({ fill: 'blue', shape: 'dot', text: 'Processing alerts...' });
    node.log('Start processing incoming message');
    node.log(`Main: complete msg keys = [${Object.keys(msg).join(', ')}]`);
    if (!validatePayload(msg)) {
        node.log('Main: validation failed, dropping message');
        node.done();
        return null;
    }
    const alerts = msg.data.event.new_state.attributes.Alerts;
    node.log(`Main: processing ${alerts.length} alerts`);
    const processed = [];
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    for (const alertItem of alerts) {
        try {
            const alert = processAlert(alertItem);
            if (!alert) continue;
            if (!trackAlert(alert.ID, now)) continue;
            const priority = assignPriority(alert.Event);
            processed.push({ event: alert.Event, priority, timestamp: nowISO, id: alert.ID, details: alert });
            node.log(`Main: Added alert ID=${alert.ID} to processed list`);
        } catch (e) {
            node.warn(`Main: Error in alert loop: ${e}`);
        }
    }

    if (processed.length === 0) {
        node.log('Main: no new alerts after processing, dropping message');
        node.status({ fill: 'yellow', shape: 'ring', text: 'No new alerts' });
        node.done();
        return null;
    }
    msg.payload = processed;
    node.log(`Main: finished processing, outputting ${processed.length} alerts`);
    node.debug(`Main: output payload = ${JSON.stringify(msg.payload)}`);
    node.status({ fill: 'green', shape: 'dot', text: `Processed ${processed.length} alert(s)` });
    node.done();
    return msg;
} catch (err) {
    node.error(`Main: critical error: ${err}`, msg);
    node.status({ fill: 'red', shape: 'ring', text: `Error: ${err.message}` });
    node.done();
    return null;
}