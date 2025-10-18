/**
 * Close Tab - Authentication Gateway
 * Version: 3.0.0
 * Date: 2025-10-17
 * 
 * Description:
 * Logs comprehensive security statistics and attack patterns when the node stops.
 * Useful for security auditing, compliance reporting, and threat detection.
 * 
 * Changelog:
 * - 3.0.0: Structured security logging, attack pattern analysis, compliance reporting
 * 
 * Instructions:
 * 1. Open the auth_gate Function node
 * 2. Click the "Close" tab (On Stop)
 * 3. Copy and paste this entire file
 * 4. Deploy
 * 
 * To view statistics: Redeploy the flow or restart Node-RED
 */

// ============================================================================
// STRUCTURED LOGGER
// ============================================================================

const LOG_PREFIX = '[Auth Gate - Security Stats]';

const logger = {
    log: (msg) => node.log(`${LOG_PREFIX} ${msg}`),
    warn: (msg) => node.warn(`${LOG_PREFIX} ${msg}`),
    error: (msg) => node.error(`${LOG_PREFIX} ${msg}`)
};

// ============================================================================
// RETRIEVE STATISTICS
// ============================================================================

const shutdownTime = Date.now();
const startupTime = context.get('startup_time') || shutdownTime;
const uptimeMs = shutdownTime - startupTime;

// Calculate uptime components
const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

// Get authentication statistics
const successCount = context.get('auth_success_count') || 0;
const failureCount = context.get('auth_failure_count') || 0;
const totalAttempts = successCount + failureCount;
const recentFailures = context.get('recent_failures') || [];

// Calculate success rate
const successRate = totalAttempts > 0 
    ? ((successCount / totalAttempts) * 100).toFixed(1) 
    : 0;

// ============================================================================
// ATTACK PATTERN ANALYSIS
// ============================================================================

// Analyze failure patterns by IP
const failuresByIP = {};
recentFailures.forEach(failure => {
    failuresByIP[failure.ip] = (failuresByIP[failure.ip] || 0) + 1;
});

// Find suspicious IPs (multiple failures)
const suspiciousIPs = Object.entries(failuresByIP)
    .filter(([ip, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

// Analyze failure reasons
const failureReasons = {};
recentFailures.forEach(failure => {
    failureReasons[failure.reason] = (failureReasons[failure.reason] || 0) + 1;
});

// ============================================================================
// STATISTICS LOGGING
// ============================================================================

// Log header
logger.log('');
logger.log('╔═══════════════════════════════════════════════════════════════╗');
logger.log('║       Authentication Gateway - Security Statistics           ║');
logger.log('╚═══════════════════════════════════════════════════════════════╝');
logger.log('');

// Log runtime information
logger.log('🕐 RUNTIME INFORMATION:');
logger.log(`   Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
logger.log(`   Startup: ${new Date(startupTime).toISOString()}`);
logger.log(`   Shutdown: ${new Date(shutdownTime).toISOString()}`);
logger.log('');

// Log authentication statistics
logger.log('🔐 AUTHENTICATION STATISTICS:');
logger.log(`   Total attempts: ${totalAttempts}`);
logger.log(`   ✅ Successful: ${successCount}`);
logger.log(`   ❌ Failed: ${failureCount}`);
logger.log(`   Success rate: ${successRate}%`);
logger.log('');

// Log failure analysis
if (failureCount > 0) {
    logger.log('📊 FAILURE ANALYSIS:');
    
    // Failure reasons
    logger.log('   Failure reasons:');
    Object.entries(failureReasons).forEach(([reason, count]) => {
        const percentage = ((count / failureCount) * 100).toFixed(1);
        logger.log(`      ${reason}: ${count} (${percentage}%)`);
    });
    logger.log('');
    
    // Suspicious IP addresses
    if (suspiciousIPs.length > 0) {
        logger.warn('⚠️  SECURITY ALERTS:');
        logger.warn(`   Found ${suspiciousIPs.length} IP(s) with multiple failures:`);
        suspiciousIPs.forEach(([ip, count]) => {
            const recentFromIP = recentFailures.filter(f => f.ip === ip);
            const firstFailure = new Date(recentFromIP[0].timestamp).toISOString();
            const lastFailure = new Date(recentFromIP[recentFromIP.length - 1].timestamp).toISOString();
            logger.warn(`      ${ip}: ${count} failures`);
            logger.warn(`         First: ${firstFailure}`);
            logger.warn(`         Last: ${lastFailure}`);
        });
        logger.warn('');
    }
} else {
    logger.log('✅ SECURITY STATUS:');
    logger.log('   No authentication failures recorded');
    logger.log('');
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
logger.log('🔄 Resetting security statistics...');
context.set('auth_success_count', 0);
context.set('auth_failure_count', 0);
context.set('recent_failures', []);
context.set('startup_time', undefined);
logger.log('✓ Statistics reset complete');
logger.log('');
*/
