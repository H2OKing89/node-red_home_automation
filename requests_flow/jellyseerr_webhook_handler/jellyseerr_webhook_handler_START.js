/**
 * Start Tab - Jellyseerr Webhook Handler
 * Version: 2.2.1
 * Date: 2025-10-17
 * 
 * Description:
 * Initializes statistics counters when the node starts.
 * This code runs once when the node is deployed or Node-RED starts.
 * 
 * Changelog:
 * - 2.2.1: Promise-based async init, enhanced error boundary with status updates
 * - 2.2.0: Added statistics tracking initialization
 * 
 * Instructions:
 * 1. Open the jellyseerr_webhook_handler Function node
 * 2. Click the "Setup" tab (On Start)
 * 3. Copy and paste this entire file
 * 4. Deploy
 */

// ============================================================================
// INITIALIZATION
// ============================================================================

// Return a Promise to queue incoming messages until initialization completes
// This ensures statistics are ready before any webhook processing begins
return (async () => {
    try {
        // Initialize total processed counter
        if (context.get('total_processed') === undefined) {
            context.set('total_processed', 0);
            node.log('Initialized total_processed counter to 0');
        }

        // Initialize validation failures counter
        if (context.get('validation_failures') === undefined) {
            context.set('validation_failures', 0);
            node.log('Initialized validation_failures counter to 0');
        }

        // Initialize startup timestamp
        context.set('startup_time', Date.now());

        // Log startup message
        const startupDate = new Date().toISOString();
        node.log('=== Jellyseerr Webhook Handler Started ===');
        node.log(`Startup time: ${startupDate}`);
        node.log('Statistics tracking enabled');
        node.log('==========================================');

        // Set initial node status
        node.status({ fill: "grey", shape: "ring", text: "Ready" });
        
        // Initialization complete - messages can now be processed
        return true;
        
    } catch (err) {
        node.error(`Setup failed: ${err.message}`);
        node.status({ fill: "red", shape: "dot", text: "Setup failed" });
        throw err; // Re-throw to prevent message processing
    }
})();
