/**
 * Start Tab - Authentication Gateway
 * Version: 3.0.0
 * Date: 2025-10-17
 * 
 * Description:
 * Initializes security statistics counters when the node starts.
 * This code runs once when the node is deployed or Node-RED starts.
 * 
 * Changelog:
 * - 3.0.0: Promise-based async init, security statistics tracking initialization
 * 
 * Instructions:
 * 1. Open the auth_gate Function node
 * 2. Click the "Setup" tab (On Start)
 * 3. Copy and paste this entire file
 * 4. Deploy
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

// Return a Promise to queue incoming messages until initialization completes
return (async () => {
    try {
        // Initialize authentication success counter
        if (context.get('auth_success_count') === undefined) {
            context.set('auth_success_count', 0);
            node.log('[Auth Gate] Initialized auth_success_count to 0');
        }

        // Initialize authentication failure counter
        if (context.get('auth_failure_count') === undefined) {
            context.set('auth_failure_count', 0);
            node.log('[Auth Gate] Initialized auth_failure_count to 0');
        }

        // Initialize recent failures tracking array
        if (context.get('recent_failures') === undefined) {
            context.set('recent_failures', []);
            node.log('[Auth Gate] Initialized recent_failures array');
        }

        // Initialize startup timestamp
        context.set('startup_time', Date.now());

        // Log startup message
        const startupDate = new Date().toISOString();
        node.log('[Auth Gate] =================================');
        node.log('[Auth Gate] Authentication Gateway Started');
        node.log('[Auth Gate] =================================');
        node.log(`[Auth Gate] Startup time: ${startupDate}`);
        node.log('[Auth Gate] Security statistics tracking enabled');
        node.log('[Auth Gate] Attack pattern detection active');
        node.log('[Auth Gate] =================================');

        // Set initial node status
        node.status({ fill: "grey", shape: "ring", text: "Ready" });
        
        // Initialization complete - messages can now be processed
        return true;
        
    } catch (err) {
        node.error(`[Auth Gate] Setup failed: ${err.message}`);
        node.status({ fill: "red", shape: "dot", text: "Setup failed" });
        throw err; // Re-throw to prevent message processing
    }
})();
