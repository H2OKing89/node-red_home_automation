/**
 * Node-RED Function node: auth_gate.js
 * Authenticates POST requests using the Authorization header.
 * Supports Bearer scheme: "Authorization: Bearer <token>"
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

const req = msg.req;

// Handle CORS preflight OPTIONS requests
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


// Get the Authorization header (case-insensitive)
const headers = req.headers || {};
const authHeader = headers['authorization'] || headers['Authorization'];

// Get the real client IP address
let clientIp = headers['x-real-ip'] || headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

// Get the expected secret (set this securely!)
const secret = global.get('auth_secret') || env.get('AUTH_SECRET');

// Validate secret is configured
if (!secret) {
    node.error("Auth secret not configured. Set auth_secret in global context or AUTH_SECRET environment variable", msg);
    return null;
}

// Extract the token from a Bearer header (or use raw header if no "Bearer " prefix)
let token = null;
if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
    } else {
        token = authHeader.trim();
    }
}

// Log authentication attempt (without exposing the token)
node.debug(`Authentication attempt from ${clientIp} for ${req.method} ${req.url}`);

// Prepare CORS & content-type headers for the response
const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
};

// Compare extracted token to secret
if (token === secret) {
    // Auth success: pass to output 1, respond 200
    node.debug("Authentication successful");
    const resMsg = {
        res: msg.res,
        statusCode: 200,
        headers: responseHeaders,
        payload: { status: 'ok' }
    };
    return [msg, resMsg];
} else {
    // Auth fail: block output 1, respond 401
    node.warn(`Authentication failed from ${clientIp} - ${authHeader ? 'invalid token' : 'missing authorization header'}`);
    const resMsg = {
        res: msg.res,
        statusCode: 401,
        headers: responseHeaders,
        payload: {
            status: 'unauthorized',
            error: 'Invalid or missing authorization'
        }
    };
    return [null, resMsg];
}
