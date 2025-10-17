/**
 * SETUP TAB CODE (On Start)
 * 
 * Copy this entire file content into the "On Start" tab in Node-RED Function node editor.
 * 
 * Purpose:
 * - Validates configuration availability
 * - Checks axios is available in global context
 * - Initializes statistics counters
 * - Sets initial node status
 * - Pre-warms state for first message
 */

// Validate axios availability
const axios = global.get('axios');
if (!axios) {
    node.warn('axios not available in global context - SMS notifications will fail');
    node.status({ fill: "red", shape: "dot", text: "axios missing" });
} else {
    node.log('axios available in global context');
}

// Pre-load and validate config
const envConfig = env.get("TEXTBEE_CONFIG");
const globalConfig = global.get("TEXTBEE_CONFIG");

if (!envConfig && !globalConfig) {
    node.error('TEXTBEE_CONFIG not found in environment or global context');
    node.status({ fill: "red", shape: "dot", text: "Config missing" });
} else {
    let config = null;
    
    // Try environment variable first
    if (envConfig) {
        if (typeof envConfig === 'object') {
            config = envConfig;
        } else {
            try {
                config = JSON.parse(envConfig);
            } catch (e) {
                node.error('Failed to parse TEXTBEE_CONFIG from environment: ' + e.message);
            }
        }
    }
    
    // Fallback to global context
    if (!config && globalConfig) {
        if (typeof globalConfig === 'object') {
            config = globalConfig;
        } else {
            try {
                config = JSON.parse(globalConfig);
            } catch (e) {
                node.error('Failed to parse TEXTBEE_CONFIG from global: ' + e.message);
            }
        }
    }
    
    if (config) {
        // Validate required fields
        if (!config.textbee || !config.textbee.api_key || !config.textbee.device_id) {
            node.error('Invalid TEXTBEE_CONFIG: missing required TextBee API fields');
            node.status({ fill: "red", shape: "dot", text: "Invalid config" });
        } else if (!config.users || !Array.isArray(config.users) || config.users.length === 0) {
            node.error('Invalid TEXTBEE_CONFIG: no users configured');
            node.status({ fill: "red", shape: "dot", text: "No users" });
        } else {
            node.log(`TextBee SMS Handler initialized with ${config.users.length} users`);
            node.status({ fill: "green", shape: "dot", text: "Ready" });
        }
    }
}

// Initialize statistics counter
if (context.get("sms_sent_count") === undefined) {
    context.set("sms_sent_count", 0);
    node.log("SMS counter initialized to 0");
}

// Initialize dedupe cleanup tracking
if (context.get("last_cleanup") === undefined) {
    context.set("last_cleanup", Date.now());
    node.log("Deduplication cleanup timer initialized");
}

// Log startup timestamp
node.log(`TextBee SMS Handler started at ${new Date().toISOString()}`);
