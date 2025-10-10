/**
 * Script Name: Jellyseerr Webhook Handler
 * Version: 2.0.0
 * Date: 2025-10-09
 * 
 * Description:
 * Normalizes incoming Jellyseerr webhook payloads for consistent downstream processing.
 * Ensures all expected fields exist with proper defaults, validates critical data,
 * and provides comprehensive logging for debugging webhook integrations.
 * 
 * Changelog:
 * - 2.0.0: Added error handling with try/catch, enhanced status updates with proper cleanup,
 *          improved code organization, added msg passing to node.error() for Catch nodes,
 *          removed memory leak from setTimeout
 * - 1.0.0: Initial implementation with basic payload normalization
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Define required fields for validation
const REQUIRED_FIELDS = ['notification_type', 'subject'];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate payload has required fields
 * @param {object} payload - Normalized payload to validate
 * @returns {object} Validation result with isValid flag and missing fields
 */
function validatePayload(payload) {
    const missing = REQUIRED_FIELDS.filter(field => !payload[field]);
    return {
        isValid: missing.length === 0,
        missingFields: missing
    };
}

// ============================================================================
// NORMALIZATION LOGIC
// ============================================================================

/**
 * Normalize Jellyseerr webhook payload structure
 * @param {object} input - Raw webhook payload
 * @returns {object} Normalized payload with consistent structure
 */
function normalizePayload(input) {
    return {
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
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

try {
    // Set initial processing status
    node.status({ fill: "blue", shape: "ring", text: "Processing..." });
    
    const input = msg.payload || {};
    
    // Debug: log the full incoming payload
    node.debug('Incoming payload: ' + JSON.stringify(input));
    node.log(`Handler node.id: ${node.id}, node.name: ${node.name}`);
    
    // Normalize the payload structure
    const normalized = normalizePayload(input);
    
    // Debug: log the normalized payload
    node.debug('Normalized payload: ' + JSON.stringify(normalized));
    
    // Log key fields for audit trail
    node.log(`notification_type: ${normalized.notification_type}`);
    node.log(`event: ${normalized.event}`);
    node.log(`subject: ${normalized.subject}`);
    node.log(`requestedBy_username: ${(normalized.request && normalized.request.requestedBy_username) || 'N/A'}`);
    
    // Validate normalized payload
    const validation = validatePayload(normalized);
    
    if (!validation.isValid) {
        // Log validation warnings
        validation.missingFields.forEach(field => {
            node.warn(`Missing required field: ${field}`);
        });
        
        // Set warning status but continue processing
        node.status({ fill: "yellow", shape: "dot", text: `Missing: ${validation.missingFields.join(', ')}` });
    } else {
        // Success status
        node.status({ fill: "green", shape: "dot", text: "Normalized successfully" });
    }
    
    // Update message payload with normalized data
    msg.payload = normalized;
    
} catch (err) {
    // Enhanced error handling - pass msg to route to Catch nodes
    node.error(`Webhook Handler Error: ${err.message}`, msg);
    node.status({ fill: "red", shape: "dot", text: `Error: ${err.message}` });
    return null;
}

return msg;
