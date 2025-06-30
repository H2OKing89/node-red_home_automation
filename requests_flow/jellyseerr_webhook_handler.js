/**
 * Node-RED Function node: jellyseerr_webhook_handler.js
 * Normalizes incoming Jellyseerr-style webhook payloads for downstream processing.
 * Demonstrates use of node context/logging/status APIs.
 */

const input = msg.payload || {};

// Debug: log the full incoming payload
node.debug('Incoming payload: ' + JSON.stringify(input));

// Ensure all top-level fields exist
const normalized = {
    notification_type: input.notification_type || null,
    event: input.event || null,
    subject: input.subject || null,
    message: input.message || null,
    image: input.image || null,
    media: input.media || {},
    request: input.request || {},
    issue: input.issue || {},
    comment: input.comment || {},
    extra: Array.isArray(input.extra) ? input.extra : []
};

msg.payload = normalized;

// Debug: log the normalized payload
node.debug('Normalized payload: ' + JSON.stringify(normalized));

// Log node info and actions
node.log(`Handler node.id: ${node.id}`);
node.log(`Handler node.name: ${node.name}`);
node.log(`Handler node.outputCount: ${node.outputCount}`);

// Log key fields
node.log(`notification_type: ${normalized.notification_type}`);
node.log(`event: ${normalized.event}`);
node.log(`subject: ${normalized.subject}`);
node.log(`requestedBy_username: ${(normalized.request && normalized.request.requestedBy_username) || ''}`);

// Example: warn if notification_type is missing
if (!normalized.notification_type) {
    node.warn('Missing notification_type in payload');
}

// Example: error if subject is missing
if (!normalized.subject) {
    node.error('Missing subject in payload');
}

// Set status to show normalization
node.status({fill: "green", shape: "dot", text: "Payload normalized"});
setTimeout(() => node.status({}), 2000); // Clear after 2s

return msg;
