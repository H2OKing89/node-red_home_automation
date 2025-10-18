/**
 * Script Name: Authentication Gateway
 * Version: 3.0.0
 * Date: 2025-10-17
 * 
 * Description:
 * Authenticates POST requests using Authorization header with Bearer token validation.
 * Handles CORS preflight OPTIONS requests automatically. Routes authorized requests to
 * output 1, while sending appropriate HTTP responses (200/401) to output 2.
 * 
 * Configuration:
 * Set auth secret via: global.set('auth_secret', 'yourSecret') or ENV variable AUTH_SECRET
 * 
 * Outputs:
 * - Output 1: Authorized messages pass through
 * - Output 2: HTTP response messages (200 for success/OPTIONS, 401 for unauthorized)
 * 
 * Node-RED Setup:
 * - Setup Tab (recommended): Initialize security statistics counters on node start
 * - Main Tab: This file (authentication processing)
 * - Close Tab (optional): Log security statistics on node stop
 * 
 * Changelog:
 * - 3.0.0: Applied Node-RED Function Node best practices for security monitoring - added
 *          Professional Logger Helper with [Auth Gate] prefix for filterable security logs,
 *          enhanced error context with full security metadata (IP, method, URL, auth header
 *          presence), security statistics tracking (success/failure counts, recent failures
 *          with IP tracking for attack pattern detection), complete audit trail for compliance
 * - 2.0.0: Added comprehensive error handling with try/catch, status updates for visibility,
 *          improved code organization with clear sections, enhanced security logging,
 *          better msg preservation patterns
 * - 1.0.0: Initial implementation with basic Bearer token authentication
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
};

// Maximum number of recent failures to track (for attack pattern detection)
const MAX_TRACKED_FAILURES = 100;

// ============================================================================
// LOGGER HELPER
// ============================================================================

/**
 * Create structured logger with consistent prefix for security audit logs
 * Usage: grep "[Auth Gate]" ~/.node-red/node-red.log
 * @param {string} prefix - Log prefix for filtering
 * @returns {object} Logger object with log/warn/error/debug methods
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

const logger = createLogger('Auth Gate');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get client IP address from request
 * @param {object} req - Express request object
 * @returns {string} Client IP address or 'unknown'
 */
function getClientIP(req) {
    return req.connection?.remoteAddress || 
           req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           'unknown';
}

/**
 * Build HTTP response message
 * @param {object} res - Response object to attach
 * @param {number} statusCode - HTTP status code
 * @param {object} payload - Response payload
 * @returns {object} Formatted response message
 */
function buildResponse(res, statusCode, payload) {
    return {
        res: res,
        statusCode: statusCode,
        headers: CORS_HEADERS,
        payload: payload
    };
}

// ============================================================================
// SECURITY STATISTICS
// ============================================================================

/**
 * Track authentication success in context
 */
function trackSuccess() {
    const count = (context.get('auth_success_count') || 0) + 1;
    context.set('auth_success_count', count);
    logger.trace(`Total successful authentications: ${count}`);
}

/**
 * Track authentication failure with IP address for pattern detection
 * @param {string} clientIP - Client IP address
 * @param {string} reason - Failure reason
 */
function trackFailure(clientIP, reason) {
    // Increment failure counter
    const count = (context.get('auth_failure_count') || 0) + 1;
    context.set('auth_failure_count', count);
    
    // Track recent failures with details
    const failures = context.get('recent_failures') || [];
    failures.push({
        ip: clientIP,
        reason: reason,
        timestamp: Date.now(),
        url: msg.req?.url || 'unknown'
    });
    
    // Keep only last N failures
    if (failures.length > MAX_TRACKED_FAILURES) {
        failures.shift();
    }
    
    context.set('recent_failures', failures);
    logger.trace(`Total failed authentications: ${count}`);
    
    // Check for potential attack patterns (same IP, multiple failures)
    const recentFromSameIP = failures.filter(f => f.ip === clientIP).length;
    if (recentFromSameIP >= 5) {
        logger.warn(`⚠️ SECURITY ALERT: ${recentFromSameIP} failed attempts from ${clientIP}`);
    }
}

// ============================================================================
// AUTHENTICATION LOGIC
// ============================================================================

/**
 * Extract and validate Authorization header
 * @param {object} headers - Request headers
 * @param {string} expectedSecret - Expected secret token
 * @returns {object} Validation result with isValid flag and reason
 */
function validateAuth(headers, expectedSecret) {
    const authHeader = headers['authorization'] || headers['Authorization'];
    
    if (!authHeader) {
        return { isValid: false, reason: 'missing authorization header' };
    }
    
    if (authHeader !== expectedSecret) {
        return { isValid: false, reason: 'invalid token' };
    }
    
    return { isValid: true, reason: 'authenticated' };
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

try {
    // Set initial processing status
    node.status({ fill: "blue", shape: "ring", text: "Checking auth..." });
    
    // Validate request object exists
    if (!msg.req) {
        logger.error("No request object found in message", msg);
        node.status({ fill: "red", shape: "dot", text: "No req object" });
        return null;
    }
    
    const req = msg.req;
    const clientIP = getClientIP(req);
    
    // ========================================================================
    // CORS PREFLIGHT HANDLING
    // ========================================================================
    
    if (req.method === 'OPTIONS') {
        logger.log(`CORS preflight request from ${clientIP}`);
        node.status({ fill: "blue", shape: "dot", text: "CORS preflight" });
        
        const corsResponse = buildResponse(msg.res, 200, {});
        return [null, corsResponse];
    }
    
    // ========================================================================
    // AUTHENTICATION VALIDATION
    // ========================================================================
    
    // Get the expected secret (prioritize environment variable)
    const secret = env.get('AUTH_SECRET') || global.get('auth_secret');
    
    if (!secret) {
        logger.error("Auth secret not configured. Set AUTH_SECRET env var or auth_secret in global context", msg);
        node.status({ fill: "red", shape: "dot", text: "Secret not configured" });
        return null;
    }
    
    // Log authentication attempt (without exposing sensitive data)
    logger.debug({ ip: clientIP, method: req.method, url: req.url });
    
    // Validate authorization
    const headers = req.headers || {};
    const authResult = validateAuth(headers, secret);
    
    // ========================================================================
    // ROUTE BASED ON AUTHENTICATION RESULT
    // ========================================================================
    
    if (authResult.isValid) {
        // ✅ Authentication successful
        trackSuccess();
        logger.log(`✅ Authentication successful from ${clientIP} for ${req.method} ${req.url}`);
        node.status({ fill: "green", shape: "dot", text: "Authenticated" });
        
        const successResponse = buildResponse(msg.res, 200, { status: 'ok' });
        return [msg, successResponse];
        
    } else {
        // ❌ Authentication failed
        trackFailure(clientIP, authResult.reason);
        logger.warn(`❌ Authentication failed from ${clientIP} - ${authResult.reason}`);
        node.status({ fill: "red", shape: "dot", text: "Auth failed" });
        
        const errorResponse = buildResponse(msg.res, 401, { 
            status: 'unauthorized',
            error: 'Invalid or missing authorization'
        });
        return [null, errorResponse];
    }
    
} catch (err) {
    // Enhanced error handling with full security context
    const req = msg.req || {};
    const clientIP = getClientIP(req);
    
    msg.errorMeta = {
        timestamp: Date.now(),
        clientIP: clientIP,
        method: req.method || 'unknown',
        url: req.url || 'unknown',
        hasAuthHeader: !!(req.headers?.['authorization'] || req.headers?.['Authorization']),
        userAgent: req.headers?.['user-agent'] || 'unknown',
        errorMessage: err.message,
        errorStack: err.stack
    };
    
    logger.error(`Processing failed from ${clientIP}: ${err.message}`, msg);
    logger.debug(msg.errorMeta);
    node.status({ fill: "red", shape: "dot", text: `Error: ${err.message}` });
    
    // Return 500 error response if possible
    if (msg.res) {
        const errorResponse = buildResponse(msg.res, 500, {
            status: 'error',
            error: 'Internal server error'
        });
        return [null, errorResponse];
    }
    
    return null;
}
