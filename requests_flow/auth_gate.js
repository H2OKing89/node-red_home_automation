/**
 * Script Name: Authentication Gateway
 * Version: 2.0.0
 * Date: 2025-10-09
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
 * Changelog:
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
        node.error("No request object found in message", msg);
        node.status({ fill: "red", shape: "dot", text: "No req object" });
        return null;
    }
    
    const req = msg.req;
    const clientIP = getClientIP(req);
    
    // ========================================================================
    // CORS PREFLIGHT HANDLING
    // ========================================================================
    
    if (req.method === 'OPTIONS') {
        node.log(`CORS preflight request from ${clientIP}`);
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
        node.error("Auth secret not configured. Set AUTH_SECRET env var or auth_secret in global context", msg);
        node.status({ fill: "red", shape: "dot", text: "Secret not configured" });
        return null;
    }
    
    // Log authentication attempt (without exposing sensitive data)
    node.debug(`Auth attempt from ${clientIP} for ${req.method} ${req.url}`);
    
    // Validate authorization
    const headers = req.headers || {};
    const authResult = validateAuth(headers, secret);
    
    // ========================================================================
    // ROUTE BASED ON AUTHENTICATION RESULT
    // ========================================================================
    
    if (authResult.isValid) {
        // ✅ Authentication successful
        node.log(`✅ Authentication successful from ${clientIP}`);
        node.status({ fill: "green", shape: "dot", text: "Authenticated" });
        
        const successResponse = buildResponse(msg.res, 200, { status: 'ok' });
        return [msg, successResponse];
        
    } else {
        // ❌ Authentication failed
        node.warn(`❌ Authentication failed from ${clientIP} - ${authResult.reason}`);
        node.status({ fill: "red", shape: "dot", text: "Auth failed" });
        
        const errorResponse = buildResponse(msg.res, 401, { 
            status: 'unauthorized',
            error: 'Invalid or missing authorization'
        });
        return [null, errorResponse];
    }
    
} catch (err) {
    // Enhanced error handling - pass msg to route to Catch nodes
    node.error(`Auth Gate Error: ${err.message}`, msg);
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
