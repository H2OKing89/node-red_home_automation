/**
 * Script Name: Jellyseerr Webhook Handler
 * Version: 2.3.0
 * Date: 2025-10-17
 * 
 * Description:
 * Normalizes incoming Jellyseerr webhook payloads for consistent downstream processing.
 * Ensures all expected fields exist with proper defaults, validates critical data,
 * and provides comprehensive logging for debugging webhook integrations.
 * 
 * Node-RED Setup:
 * - Setup Tab (optional): Initialize statistics counters on node start
 * - Main Tab: This file (message normalization)
 * - Close Tab (optional): Log final statistics on node stop
 * 
 * Changelog:
 * - 2.3.0: Applied Node-RED Function Node best practices - added Professional Logger Helper
 *          with [Webhook Handler] prefix for filterable logs, enhanced error context with
 *          diagnostic metadata (timestamp, event type, payload size), optimized batch context
 *          operations for statistics tracking
 * - 2.2.0: Added statistics tracking with context storage - tracks total processed webhooks,
 *          per-event-type counters, validation failure counts; added node.trace() for deep
 *          debugging of HTTP request details; follows Node-RED Function node best practices
 *          for context usage and structured logging
 * - 2.1.1: Added support for both issue.id and issue.issue_id field names for backward
 *          compatibility with different webhook template configurations, ensures issue IDs
 *          are always displayed in node status regardless of template format
 * - 2.1.0: Enhanced node status display to include request_id or issue id for tracking,
 *          shows "✓ Normalized [ID: 150]" format, helps identify which webhook is being
 *          processed when multiple webhooks arrive simultaneously
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
// LOGGER HELPER
// ============================================================================

/**
 * Create structured logger with consistent prefix for filterable logs
 * Usage: grep "[Webhook Handler]" ~/.node-red/node-red.log
 * @param {string} prefix - Log prefix for filtering
 * @returns {object} Logger object with log/warn/error/debug/trace methods
 */
function createLogger(prefix) {
    return {
        log: (msg) => node.log(`[${prefix}] ${msg}`),
        warn: (msg) => node.warn(`[${prefix}] ${msg}`),
        error: (msg, err) => node.error(`[${prefix}] ${msg}`, err),
        debug: (obj) => node.debug(`[${prefix}] ${JSON.stringify(obj)}`),
        trace: (msg) => node.trace(`[${prefix}] ${msg}`)
    };
}

const logger = createLogger('Webhook Handler');

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
    
    // Track processing statistics (batch context operations)
    const [totalProcessed, validationFailures] = context.get(['total_processed', 'validation_failures']);
    const newTotalProcessed = (totalProcessed || 0) + 1;
    
    const input = msg.payload || {};
    
    // Debug: log the full incoming payload
    logger.debug(input);
    logger.trace(`Raw HTTP request: ${msg.req?.method} ${msg.req?.url}`);
    logger.log(`Processing webhook #${newTotalProcessed}`);
    
    // Normalize the payload structure
    const normalized = normalizePayload(input);
    
    // Debug: log the normalized payload
    logger.debug(normalized);
    
    // Log key fields for audit trail
    logger.log(`Type: ${normalized.notification_type}, Event: ${normalized.event}`);
    logger.log(`Subject: ${normalized.subject}`);
    logger.log(`Requested by: ${normalized.request?.requestedBy_username || 'N/A'}`);
    
    // Track event type statistics
    let newValidationFailures = validationFailures || 0;
    if (normalized.notification_type) {
        const eventKey = `event_${normalized.notification_type}`;
        const eventCount = (context.get(eventKey) || 0) + 1;
        context.set(eventKey, eventCount);
        logger.trace(`Event ${normalized.notification_type} count: ${eventCount}`);
    }
    
    // Validate normalized payload
    const validation = validatePayload(normalized);
    
    // Extract request ID or issue ID for status display
    // Support both 'id' and 'issue_id' field names for compatibility
    const requestId = normalized.request?.request_id || 
                      normalized.issue?.id || 
                      normalized.issue?.issue_id || 
                      null;
    const idText = requestId ? ` [ID: ${requestId}]` : '';
    
    if (!validation.isValid) {
        // Log validation warnings
        validation.missingFields.forEach(field => {
            logger.warn(`Missing required field: ${field}`);
        });
        
        // Track validation failures
        newValidationFailures = (validationFailures || 0) + 1;
        logger.trace(`Total validation failures: ${newValidationFailures}`);
        
        // Set warning status but continue processing
        node.status({ fill: "yellow", shape: "dot", text: `Missing: ${validation.missingFields.join(', ')}${idText}` });
    } else {
        // Success status with request ID
        node.status({ fill: "green", shape: "dot", text: `✓ Normalized${idText}` });
    }
    
    // Batch update statistics in context
    context.set(['total_processed', 'validation_failures'], [newTotalProcessed, newValidationFailures]);
    
    // Update message payload with normalized data
    msg.payload = normalized;
    
} catch (err) {
    // Enhanced error handling with diagnostic metadata
    const input = msg.payload || {};
    msg.errorMeta = {
        timestamp: Date.now(),
        notification_type: input.notification_type || null,
        event: input.event || null,
        payloadSize: JSON.stringify(input).length,
        errorMessage: err.message,
        errorStack: err.stack
    };
    
    logger.error(`Processing failed: ${err.message}`, msg);
    logger.debug(msg.errorMeta);
    node.status({ fill: "red", shape: "dot", text: `Error: ${err.message}` });
    return null;
}

return msg;
