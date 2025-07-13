/**
 * Node-RED Function node: auth_gate.js
 * Authenticates POST requests using the Authorization header.
 * Handles CORS preflight OPTIONS requests with 200 response.
 * Output 1: Passes msg if authorized.
 * Output 2: Returns HTTP response with status 200 (authorized/OPTIONS), or 401 (unauthorized).
 *
 * Set your secret securely: global.set('auth_secret', 'yourSecret') or ENV AUTH_SECRET.
 */

// Validate we have a proper request object
if (!msg.req) {
    node.error("No request object found in message", msg);
    return null;
}

// Handle CORS preflight OPTIONS requests
const req = msg.req;
if (req.method === 'OPTIONS') {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Content-Type': 'application/json'
    };
    return [null, {
        res: msg.res,
        statusCode: 200,
        headers: corsHeaders,
        payload: {}
    }];
}

// Get the Authorization header (case-insensitive, robust extraction)
const headers = req.headers || {};
const authHeader = headers['authorization'] || headers['Authorization'];

// Get the expected secret (set this securely!)
const secret = global.get('auth_secret') || env.get('AUTH_SECRET');

// Validate secret is configured
if (!secret) {
    node.error("Auth secret not configured. Set auth_secret in global context or AUTH_SECRET environment variable", msg);
    return null;
}

// Log authentication attempt (without exposing sensitive data)
node.debug(`Authentication attempt from ${req.connection?.remoteAddress || 'unknown'} for ${req.method} ${req.url}`);

// Prepare CORS and content-type headers
const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
};

if (authHeader && authHeader === secret) {
    // Auth success: pass to output 1, respond 200
    node.debug("Authentication successful");
    const resMsg = {
        res: msg.res, // Attach the response object
        statusCode: 200,
        headers: responseHeaders,
        payload: { status: 'ok' }
    };
    return [msg, resMsg];
} else {
    // Auth fail: block output 1, respond 401
    node.warn(`Authentication failed from ${req.connection?.remoteAddress || 'unknown'} - ${authHeader ? 'invalid token' : 'missing authorization header'}`);
    const resMsg = {
        res: msg.res, // Attach the response object
        statusCode: 401,
        headers: responseHeaders,
        payload: { 
            status: 'unauthorized',
            error: 'Invalid or missing authorization'
        }
    };
    return [null, resMsg];
}
