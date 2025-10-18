# Lifecycle Scripts Improvements - v2.2.1

**Date**: October 17, 2025  
**Files Modified**:

- `jellyseerr_webhook_handler_START.js` (v2.2.1)
- `jellyseerr_webhook_handler_CLOSE.js` (v2.2.1)

## Overview

This document details the Node-RED Function Node best practices applied to the lifecycle management scripts for the Jellyseerr Webhook Handler, based on the comprehensive patterns in `docs/function_node/node_red_function_node_practical_guide.md`.

---

## Improvements Applied

### 1. **Promise-Based Async Initialization** (Setup Tab)

**Pattern**: Return a Promise from Setup tab to queue messages until initialization completes

**Implementation**:

```javascript
return (async () => {
    try {
        // Initialize counters...
        context.set('total_processed', 0);
        // ... more initialization
        return true; // Signals initialization complete
    } catch (err) {
        node.error(`Setup failed: ${err.message}`);
        throw err; // Re-throw to prevent message processing
    }
})();
```

**Benefits**:

- Prevents race conditions where webhooks arrive before counters are initialized
- Node-RED queues incoming messages until Promise resolves
- Ensures statistics are always in consistent state before processing begins

---

### 2. **Error Boundary Pattern** (Setup Tab)

**Pattern**: Comprehensive try/catch with status updates and error propagation

**Implementation**:

```javascript
try {
    // Initialization logic
    node.status({ fill: "grey", shape: "ring", text: "Ready" });
    return true;
} catch (err) {
    node.error(`Setup failed: ${err.message}`);
    node.status({ fill: "red", shape: "dot", text: "Setup failed" });
    throw err; // Prevents message processing on init failure
}
```

**Benefits**:

- Visual indication of initialization success/failure via node status
- Prevents webhook processing if setup fails
- Error logged to Node-RED debug panel for troubleshooting

---

### 3. **Structured Logging with Prefixes** (Close Tab)

**Pattern**: Logger helper object with consistent prefixing for log filtering

**Implementation**:

```javascript
const LOG_PREFIX = '[Shutdown Stats]';

const logger = {
    log: (msg) => node.log(`${LOG_PREFIX} ${msg}`),
    warn: (msg) => node.warn(`${LOG_PREFIX} ${msg}`),
    error: (msg) => node.error(`${LOG_PREFIX} ${msg}`)
};

// Usage throughout script
logger.log('📊 RUNTIME INFORMATION:');
logger.warn('⚠️  VALIDATION WARNINGS:');
```

**Benefits**:

- Easy log filtering: `grep "[Shutdown Stats]" ~/.node-red/node-red.log`
- Consistent log format across all shutdown statistics
- Clear separation from main node processing logs
- Supports different log levels (log/warn/error) with same prefix

---

### 4. **Safe Division with Edge Case Handling** (Close Tab)

**Pattern**: Prevent divide-by-zero errors and provide extrapolated rates for short sessions

**Implementation**:

```javascript
// Safe division for processing rate
const avgPerHour = uptimeMinutes > 0
    ? totalProcessed > 0
        ? uptimeHours >= 1
            ? (totalProcessed / uptimeHours).toFixed(2)
            : `${((totalProcessed / uptimeMinutes) * 60).toFixed(2)} (extrapolated)`
        : '0'
    : 'N/A (instant shutdown)';
```

**Benefits**:

- Handles immediate shutdown (0 uptime) gracefully
- Provides extrapolated hourly rate for sessions < 1 hour
- More useful insights for short test deployments (e.g., "120 (extrapolated)" for 5-minute session with 10 webhooks)
- Prevents misleading "0 webhooks/hour" for successful short sessions

---

### 5. **Enhanced Visual Output** (Close Tab)

**Pattern**: Unicode box-drawing characters and emoji icons for structured terminal output

**Implementation**:

```javascript
logger.log('╔═══════════════════════════════════════════════════════════════╗');
logger.log('║       Jellyseerr Webhook Handler - Final Statistics          ║');
logger.log('╚═══════════════════════════════════════════════════════════════╝');

logger.log('📊 RUNTIME INFORMATION:');
logger.log('📈 PROCESSING STATISTICS:');
logger.log('🎯 EVENT TYPE BREAKDOWN:');

// Bar charts for event distribution
const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
logger.log(`   ${eventType.padEnd(25)} ${bar} ${count.toString().padStart(4)} (${percentage}%)`);
```

**Benefits**:

- Easy visual scanning of statistics in terminal/logs
- Clear section separation with box-drawing borders
- Bar charts provide instant visual understanding of event distribution
- Professional appearance suitable for production monitoring

---

## Example Output

### Setup Tab (On Deploy)

```
[Shutdown Stats] === Jellyseerr Webhook Handler Started ===
[Shutdown Stats] Startup time: 2025-10-17T22:45:30.123Z
[Shutdown Stats] Statistics tracking enabled
[Shutdown Stats] ==========================================
```

*(Node status shows grey dot: "Ready")*

### Close Tab (On Node Shutdown)

```
[Shutdown Stats] 
[Shutdown Stats] ╔═══════════════════════════════════════════════════════════════╗
[Shutdown Stats] ║       Jellyseerr Webhook Handler - Final Statistics          ║
[Shutdown Stats] ╚═══════════════════════════════════════════════════════════════╝
[Shutdown Stats] 
[Shutdown Stats] 📊 RUNTIME INFORMATION:
[Shutdown Stats]    Uptime: 2h 35m
[Shutdown Stats]    Shutdown: 2025-10-18T01:20:30.456Z
[Shutdown Stats] 
[Shutdown Stats] 📈 PROCESSING STATISTICS:
[Shutdown Stats]    Total webhooks processed: 47
[Shutdown Stats]    Validation failures: 2
[Shutdown Stats]    Success rate: 95.7%
[Shutdown Stats]    Average processing rate: 18.15 webhooks/hour
[Shutdown Stats] 
[Shutdown Stats] 🎯 EVENT TYPE BREAKDOWN:
[Shutdown Stats]    media.REQUESTED          ████████████████░░░░ 38 (80.9%)
[Shutdown Stats]    media.AVAILABLE          ████░░░░░░░░░░░░░░░░  8 (17.0%)
[Shutdown Stats]    media.APPROVED           ░░░░░░░░░░░░░░░░░░░░  1 (2.1%)
[Shutdown Stats] 
[Shutdown Stats] ⚠️  VALIDATION WARNINGS:
[Shutdown Stats]    2 webhook(s) had missing required fields
[Shutdown Stats]    Check logs for details on which fields were missing
[Shutdown Stats] 
[Shutdown Stats] ═══════════════════════════════════════════════════════════════
[Shutdown Stats] 
```

---

## Usage Instructions

### Deploying Setup Tab

1. Open `jellyseerr_webhook_handler` Function node in Node-RED
2. Click **"Setup"** tab (On Start)
3. Copy entire contents of `jellyseerr_webhook_handler_START.js`
4. Paste into Setup tab
5. Click **Done** and **Deploy**

### Deploying Close Tab

1. Open `jellyseerr_webhook_handler` Function node in Node-RED
2. Click **"Close"** tab (On Stop)
3. Copy entire contents of `jellyseerr_webhook_handler_CLOSE.js`
4. Paste into Close tab
5. Click **Done** and **Deploy**

### Viewing Statistics

**Method 1: Node Shutdown**

- Redeploy the flow (Ctrl+D / Cmd+D)
- Statistics automatically logged to Node-RED debug panel

**Method 2: Manual Query (Coming Soon)**

- Create debug helper flow to read context values
- See `requests_flow/docs/QUERY_STATS.md` (future enhancement)

**Method 3: Log Filtering**

```bash
# View all shutdown statistics
grep "\[Shutdown Stats\]" ~/.node-red/node-red.log

# View only warnings
grep "\[Shutdown Stats\].*⚠️" ~/.node-red/node-red.log
```

---

## Migration Notes

### From v2.2.0 to v2.2.1

**Breaking Changes**: None

**New Features**:

- Promise-based initialization (Setup tab)
- Structured logging with prefixes (Close tab)
- Safe division with extrapolated rates (Close tab)
- Enhanced error boundaries (Setup tab)

**Action Required**:

1. Update both Setup and Close tabs with new v2.2.1 code
2. No changes needed to main Function node code
3. Deploy and test with sample webhook

**Compatibility**:

- Requires Node-RED >= 1.0 (for Setup/Close tabs)
- No external module dependencies
- Works with all Jellyseerr event types

---

## Best Practices Applied

✅ **Async Completion Tracking**: Setup tab returns Promise for message queuing  
✅ **Error Boundaries**: Comprehensive try/catch with visual status updates  
✅ **Structured Logging**: Consistent prefix for log filtering and organization  
✅ **Safe Math**: Division by zero protection, edge case handling  
✅ **Visual Design**: Unicode box-drawing, emoji icons, bar charts  
✅ **Documentation**: Inline comments explain patterns and benefits  

---

## Future Enhancements

### Potential Improvements

1. **Live Statistics Query**
   - Create HTTP endpoint to query stats without redeploying
   - Return JSON for dashboard integration

2. **Metric Persistence**
   - Option to write statistics to file/database on shutdown
   - Historical trend analysis over time

3. **Alert Thresholds**
   - Configurable thresholds for validation failure rates
   - Automatic notifications if processing rate drops

4. **Performance Profiling**
   - Track min/max/avg processing time per webhook
   - Identify slow event types for optimization

---

## References

- **Node-RED Function Node Guide**: `docs/function_node/node_red_function_node_practical_guide.md`
- **Main Script**: `jellyseerr_webhook_handler.js` (v2.2.0)
- **Webhook Template**: `docs/JELLYSEERR_WEBHOOK_TEMPLATE.md`
- **Project Instructions**: `.github/copilot-instructions.md`

---

## Version History

### v2.2.1 (2025-10-17)

- **Setup Tab**: Added Promise-based async initialization, enhanced error boundary
- **Close Tab**: Structured logging with prefixes, safe division with extrapolated rates, logger helper object

### v2.2.0 (2025-10-17)

- Initial lifecycle scripts with statistics tracking
- Basic initialization and shutdown logging
- Event type breakdown with bar charts

---

*These improvements ensure production-grade observability and reliability for the Jellyseerr webhook notification pipeline, following Node-RED best practices and patterns.*
