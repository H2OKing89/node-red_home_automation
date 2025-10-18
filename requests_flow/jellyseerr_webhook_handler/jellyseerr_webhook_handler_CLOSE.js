/**
 * Close Tab - Jellyseerr Webhook Handler
 * Version: 2.2.1
 * Date: 2025-10-17
 * 
 * Description:
 * Logs final statistics when the node is stopped, redeployed, or Node-RED shuts down.
 * This provides visibility into webhook processing patterns and helps identify issues.
 * 
 * Updates:
 * - 2.2.1: Added structured logging with prefixes, error handling for edge cases,
 *          safe division for rate calculations, improved zero-state messaging
 * 
 * Instructions:
 * 1. Open the jellyseerr_webhook_handler Function node
 * 2. Click the "Close" tab (On Stop)
 * 3. Copy and paste this entire file
 * 4. Deploy
 */

// ============================================================================
// STATISTICS COLLECTION
// ============================================================================

// Structured logger for consistent output
const logger = {
    log: (msg) => node.log(`[Shutdown Stats] ${msg}`),
    warn: (msg) => node.warn(`[Shutdown Stats] ${msg}`),
    error: (msg) => node.error(`[Shutdown Stats] ${msg}`)
};

// Retrieve final statistics
const totalProcessed = context.get('total_processed') || 0;
const validationFailures = context.get('validation_failures') || 0;
const startupTime = context.get('startup_time') || Date.now();

// Calculate uptime
const shutdownTime = Date.now();
const uptimeMs = shutdownTime - startupTime;
const uptimeMinutes = Math.floor(uptimeMs / 60000);
const uptimeHours = Math.floor(uptimeMinutes / 60);
const uptimeDisplayMinutes = uptimeMinutes % 60;

// Calculate processing rate with safe division
let avgPerHour = 'N/A';
if (uptimeHours > 0) {
    avgPerHour = (totalProcessed / uptimeHours).toFixed(2);
} else if (uptimeMinutes > 0) {
    // For sessions less than 1 hour, extrapolate to hourly rate
    avgPerHour = ((totalProcessed / uptimeMinutes) * 60).toFixed(2) + ' (extrapolated)';
}

// ============================================================================
// EVENT TYPE BREAKDOWN
// ============================================================================

// Collect event type statistics
const contextKeys = context.keys();
const eventCounts = {};
let totalEventCount = 0;

contextKeys.forEach(key => {
    if (key.startsWith('event_')) {
        const eventType = key.replace('event_', '');
        const count = context.get(key);
        eventCounts[eventType] = count;
        totalEventCount += count;
    }
});

// Sort events by count (descending)
const sortedEvents = Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1]);

// ============================================================================
// STATISTICS LOGGING
// ============================================================================

// Log header
logger.log('');
logger.log('╔═══════════════════════════════════════════════════════════════╗');
logger.log('║       Jellyseerr Webhook Handler - Final Statistics          ║');
logger.log('╚═══════════════════════════════════════════════════════════════╝');
logger.log('');

// Log runtime information
logger.log('📊 RUNTIME INFORMATION:');
logger.log(`   Uptime: ${uptimeHours}h ${uptimeDisplayMinutes}m`);
logger.log(`   Shutdown: ${new Date(shutdownTime).toISOString()}`);
logger.log('');

// Log processing statistics
logger.log('📈 PROCESSING STATISTICS:');
logger.log(`   Total webhooks processed: ${totalProcessed}`);
logger.log(`   Validation failures: ${validationFailures}`);
logger.log(`   Success rate: ${totalProcessed > 0 ? ((totalProcessed - validationFailures) / totalProcessed * 100).toFixed(1) : 0}%`);
logger.log(`   Average processing rate: ${avgPerHour} webhooks/hour`);
logger.log('');

// Log event type breakdown
if (sortedEvents.length > 0) {
    logger.log('🎯 EVENT TYPE BREAKDOWN:');
    sortedEvents.forEach(([eventType, count]) => {
        const percentage = totalEventCount > 0 ? ((count / totalEventCount) * 100).toFixed(1) : 0;
        const barLength = Math.floor((count / totalProcessed) * 20);
        const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
        logger.log(`   ${eventType.padEnd(25)} ${bar} ${count.toString().padStart(4)} (${percentage}%)`);
    });
    logger.log('');
} else {
    logger.log('🎯 EVENT TYPE BREAKDOWN:');
    logger.log('   No events processed during this session');
    logger.log('');
}

// Log validation details if there were failures
if (validationFailures > 0) {
    logger.warn('⚠️  VALIDATION WARNINGS:');
    logger.warn(`   ${validationFailures} webhook(s) had missing required fields`);
    logger.warn('   Check logs for details on which fields were missing');
    logger.warn('');
}

// Log footer
logger.log('═══════════════════════════════════════════════════════════════');
logger.log('');

// ============================================================================
// OPTIONAL: RESET COUNTERS
// ============================================================================

// Uncomment the following lines to reset statistics on node stop
// This is useful if you want fresh stats after each deployment
// Otherwise, statistics will persist across deployments

/*
logger.log('🔄 Resetting statistics counters...');
context.set('total_processed', 0);
context.set('validation_failures', 0);
context.set('startup_time', undefined);

// Reset all event counters
contextKeys.forEach(key => {
    if (key.startsWith('event_')) {
        context.set(key, undefined);
    }
});

logger.log('✓ Statistics reset complete');
logger.log('');
*/
