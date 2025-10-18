/**
 * CLOSE TAB CODE (On Stop)
 * 
 * Copy this entire file content into the "On Close" tab in Node-RED Function node editor.
 * 
 * Purpose:
 * - Logs session statistics
 * - Cleans up old deduplication keys (prevents memory leaks)
 * - Resets counters for next session
 * - Graceful shutdown logging
 */

// Log statistics
const smsSentCount = context.get("sms_sent_count") || 0;
node.log(`TextBee SMS Handler stopping - Total SMS sent this session: ${smsSentCount}`);

// Clean up old deduplication keys (older than 24 hours)
const allKeys = context.keys();
const now = Date.now();
const maxAge = 24 * 60 * 60 * 1000; // 24 hours
let cleanedCount = 0;
let totalDedupeKeys = 0;

allKeys.forEach(key => {
    // Only clean dedupe keys (prefixed with "dd:")
    if (key.startsWith('dd:')) {
        totalDedupeKeys++;
        const timestamp = context.get(key);
        
        if (timestamp && (now - timestamp) > maxAge) {
            context.set(key, undefined);
            cleanedCount++;
        }
    }
});

if (totalDedupeKeys > 0) {
    node.log(`Found ${totalDedupeKeys} deduplication keys in context`);
}

if (cleanedCount > 0) {
    node.log(`Cleaned up ${cleanedCount} old deduplication keys (older than 24 hours)`);
} else {
    node.log("No old deduplication keys to clean up");
}

// Reset counters for next start
context.set("sms_sent_count", 0);
context.set("last_cleanup", now);

// Log shutdown timestamp
node.log(`TextBee SMS Handler stopped at ${new Date().toISOString()}`);
node.log("TextBee SMS Handler cleanup complete");

// Clear node status
node.status({});
