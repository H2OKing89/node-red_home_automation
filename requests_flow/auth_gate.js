/**
 * Node-RED Function node: auth_gate.js
 * Authenticates POST requests using the Authorization header.
 * Output 1: Passes msg if authorized.
 * Output 2: Returns HTTP response with status 200 (authorized) or 401 (unauthorized).
 *
 * Set your secret in Node-RED global context as global.get('auth_secret') or via environment variable.
 */

// Get the Authorization header (case-insensitive)
const req = msg.req;
const headers = req && req.headers ? req.headers : {};
const authHeader = headers['authorization'] || headers['Authorization'];

// Get the expected secret (set this securely!)
const secret = global.get('auth_secret') || env.get('AUTH_SECRET');

// Prepare CORS and content-type headers
const responseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Content-Type': 'application/json'
};

if (authHeader && secret && authHeader === secret) {
    // Auth success: pass to output 1, respond 200
    const resMsg = {
        res: msg.res, // Attach the response object
        statusCode: 200,
        headers: responseHeaders,
        payload: { status: 'ok' }
    };
    return [msg, resMsg];
} else {
    // Auth fail: block output 1, respond 401
    const resMsg = {
        res: msg.res, // Attach the response object
        statusCode: 401,
        headers: responseHeaders,
        payload: { status: 'unauthorized' }
    };
    return [null, resMsg];
}
