# Webhook Handler Upgrade - v2.3.0

**Date**: October 17, 2025  
**File**: `jellyseerr_webhook_handler.js`

## Overview

Applied comprehensive Node-RED Function Node best practices from `docs/function_node/node_red_function_node_practical_guide.md` to the main webhook handler, bringing it to full compliance with professional patterns used in the lifecycle scripts.

---

## ✅ **Three Best Practices Applied**

### **1. Professional Logger Helper** (Section 9.7)

**Pattern**: Structured logger with consistent `[Webhook Handler]` prefix for filterable logs

**Implementation**:

```javascript
function createLogger(prefix) {
    return {
        log: (msg) => node.log(`[${prefix}] ${msg}`),
        warn: (msg) => node.warn(`[${prefix}] ${msg}`),
        error: (msg, err) => node.error(`[${prefix}] ${msg}`, err),
        debug: (obj) => node.debug(`[${prefix}] ${JSON.stringify(obj)}`),
        trace: (msg) => node.trace(`[${prefix}] ${msg}`)
    };
}

const logger = createLogger('Webhook Handler');
```

**Benefits**:

- **Easy log filtering**: `grep "[Webhook Handler]" ~/.node-red/node-red.log`
- **Consistent format**: All logs prefixed for clear identification
- **Clean code**: `logger.log()` instead of `node.log()` throughout
- **Debug objects**: Automatic JSON stringification for complex objects

**Usage Examples**:

```javascript
// Before
node.log(`notification_type: ${normalized.notification_type}`);
node.warn(`Missing required field: ${field}`);
node.debug('Incoming payload: ' + JSON.stringify(input));

// After
logger.log(`Type: ${normalized.notification_type}, Event: ${normalized.event}`);
logger.warn(`Missing required field: ${field}`);
logger.debug(input);  // Auto-stringifies
```

---

### **2. Enhanced Error Context** (Section 9.6)

**Pattern**: Add diagnostic metadata to error messages for better troubleshooting

**Implementation**:

```javascript
catch (err) {
    const input = msg.payload || {};
    msg.errorMeta = {
        timestamp: Date.now(),
        notification_type: input.notification_type || null,
        event: input.event || null,
        payloadSize: JSON.stringify(input).length,
        errorMessage: err.message,
        errorStack: err.stack
    };
    
    logger.error(`Processing failed: ${err.message}`, msg);
    logger.debug(msg.errorMeta);
    node.status({ fill: "red", shape: "dot", text: `Error: ${err.message}` });
    return null;
}
```

**Benefits**:

- **Context preservation**: Error metadata attached to msg for Catch nodes
- **Pattern detection**: Identify if errors correlate with specific event types
- **Payload size tracking**: Helps identify if large payloads cause issues
- **Full stack traces**: Complete error details for debugging
- **Timestamp correlation**: Match errors with external logs/metrics

**Error Metadata Structure**:

```javascript
msg.errorMeta = {
    timestamp: 1729285245123,           // Unix timestamp
    notification_type: "media.AVAILABLE", // Event type when error occurred
    event: "available",                  // Jellyseerr event
    payloadSize: 1547,                   // Bytes (helps identify oversized payloads)
    errorMessage: "Cannot read property 'x' of undefined",
    errorStack: "TypeError: Cannot read property..."
}
```

---

### **3. Batch Context Operations** (Section 3)

**Pattern**: Optimize multiple context reads/writes with batch operations

**Implementation**:

```javascript
// Before: Multiple separate context operations
const totalProcessed = (context.get('total_processed') || 0) + 1;
context.set('total_processed', totalProcessed);
// ... later ...
const validationFailures = (context.get('validation_failures') || 0) + 1;
context.set('validation_failures', validationFailures);

// After: Single batch read, single batch write
const [totalProcessed, validationFailures] = context.get(['total_processed', 'validation_failures']);
const newTotalProcessed = (totalProcessed || 0) + 1;
let newValidationFailures = validationFailures || 0;

// ... process webhook ...

if (!validation.isValid) {
    newValidationFailures = (validationFailures || 0) + 1;
}

// Single batch write at end
context.set(['total_processed', 'validation_failures'], [newTotalProcessed, newValidationFailures]);
```

**Benefits**:

- **Performance**: Fewer context store accesses (especially important for persistent stores)
- **Atomicity**: Related values updated together
- **Cleaner logic**: Calculate all updates, then write once
- **Reduced I/O**: Particularly beneficial if using file-based or database context stores

**Performance Impact**:

- **Before**: 2-3 context reads + 2-3 context writes per webhook
- **After**: 1 context read + 1 context write per webhook
- **Improvement**: ~50% reduction in context store operations

---

## **Code Changes Summary**

### **Log Output Changes**

**Before (v2.2.0)**:

```
[info] Handler node.id: abc123, node.name: Webhook Handler
[debug] Incoming payload: {"notification_type":"media.REQUESTED",...}
[info] notification_type: media.REQUESTED
[info] event: requested
[info] subject: New Request from Betty King
[warn] Missing required field: subject
[trace] Event media.REQUESTED count: 42
```

**After (v2.3.0)**:

```
[info] [Webhook Handler] Processing webhook #42
[debug] [Webhook Handler] {"notification_type":"media.REQUESTED",...}
[trace] [Webhook Handler] Raw HTTP request: POST /webhooks/jellyseerr
[info] [Webhook Handler] Type: media.REQUESTED, Event: requested
[info] [Webhook Handler] Subject: New Request from Betty King
[info] [Webhook Handler] Requested by: betty.king
[warn] [Webhook Handler] Missing required field: subject
[trace] [Webhook Handler] Event media.REQUESTED count: 42
```

**Filtering Examples**:

```bash
# All webhook handler logs
grep "\[Webhook Handler\]" ~/.node-red/node-red.log

# Only warnings and errors
grep "\[Webhook Handler\]" ~/.node-red/node-red.log | grep -E "\[warn\]|\[error\]"

# Debug payload details
grep "\[Webhook Handler\].*notification_type" ~/.node-red/node-red.log

# Count webhooks processed in session
grep "\[Webhook Handler\] Processing webhook" ~/.node-red/node-red.log | wc -l
```

---

## **Migration Guide**

### **From v2.2.0 to v2.3.0**

**Breaking Changes**: None - fully backward compatible

**Action Required**:

1. Copy new v2.3.0 code into Function node Main tab
2. Deploy
3. Test with sample webhook
4. Verify logs show `[Webhook Handler]` prefix

**Compatible With**:

- ✅ Existing lifecycle scripts (START/CLOSE v2.2.1)
- ✅ All Jellyseerr event types
- ✅ Both webhook template formats (issue.id and issue.issue_id)
- ✅ Existing context stores (memory/file)

---

## **Testing Checklist**

### **Functional Testing**

- [ ] Send test webhook (media.REQUESTED)
- [ ] Verify logs show `[Webhook Handler]` prefix
- [ ] Check node status displays request ID
- [ ] Confirm statistics tracking still works
- [ ] Test validation failure handling

### **Error Testing**

- [ ] Send malformed JSON
- [ ] Send webhook missing required fields
- [ ] Verify `msg.errorMeta` attached to errors
- [ ] Check error logs include diagnostic context

### **Performance Verification**

- [ ] Process 10+ webhooks rapidly
- [ ] Verify context operations complete without delays
- [ ] Check statistics counters increment correctly
- [ ] Monitor memory usage (should be stable)

---

## **Production Deployment**

### **Pre-Deployment**

1. Backup existing flow (Export to JSON)
2. Document current statistics values (optional, for continuity)
3. Review changelog and migration notes

### **Deployment Steps**

1. Open `jellyseerr_webhook_handler` Function node
2. Copy entire contents of `jellyseerr_webhook_handler.js` (v2.3.0)
3. Paste into Main tab (replace existing)
4. Click **Done**
5. Click **Deploy**
6. Monitor Debug panel for `[Webhook Handler]` logs

### **Post-Deployment Validation**

1. Trigger test webhook from Jellyseerr
2. Verify processing completes successfully
3. Check logs for proper prefix formatting
4. Confirm node status updates correctly
5. Review statistics in Close tab (redeploy to see)

---

## **Log Analysis Examples**

### **Real-Time Monitoring**

```bash
# Follow webhook processing live
tail -f ~/.node-red/node-red.log | grep "\[Webhook Handler\]"

# Count events per type
grep "\[Webhook Handler\] Type:" ~/.node-red/node-red.log | \
  awk -F'Type: ' '{print $2}' | sort | uniq -c

# Find validation failures
grep "\[Webhook Handler\].*Missing required" ~/.node-red/node-red.log
```

### **Troubleshooting**

```bash
# View recent errors with full context
grep -A 5 "\[Webhook Handler\].*Error" ~/.node-red/node-red.log | tail -30

# Extract error metadata
grep "\[Webhook Handler\].*errorMeta" ~/.node-red/node-red.log | \
  jq '.errorMeta'

# Check processing rate
grep "\[Webhook Handler\] Processing webhook #" ~/.node-red/node-red.log | \
  awk '{print $1, $2}' | uniq -c
```

---

## **Feature Comparison**

| Feature | v2.2.0 | v2.3.0 | Improvement |
|---------|--------|--------|-------------|
| **Structured Logging** | ❌ No prefix | ✅ `[Webhook Handler]` prefix | Easy filtering |
| **Error Metadata** | ⚠️ Basic message | ✅ Full diagnostic context | Better debugging |
| **Context Operations** | ⚠️ Multiple reads/writes | ✅ Batch operations | ~50% fewer I/O |
| **Log Consistency** | ⚠️ Mixed formats | ✅ Uniform prefix | Professional output |
| **Debug Objects** | ⚠️ Manual stringify | ✅ Auto-stringify in logger | Cleaner code |
| **Performance** | Good | **Better** | Optimized context access |

---

## **Next Steps (Optional Enhancements)**

### **Potential Future Improvements**

1. **Rate Limiting Detection**
   - Track webhook arrival rate
   - Warn if exceeding expected thresholds
   - Useful for detecting Jellyseerr misconfigurations

2. **Schema Validation**
   - Add JSON schema validation for webhook payloads
   - Catch structural issues early
   - Generate detailed validation reports

3. **Payload Archival**
   - Optionally store recent N payloads in context
   - Useful for debugging intermittent issues
   - Implement circular buffer pattern

4. **Metrics Export**
   - Expose statistics via HTTP endpoint
   - Enable external monitoring dashboards
   - Track webhook health over time

---

## **References**

- **Node-RED Function Node Guide**: `docs/function_node/node_red_function_node_practical_guide.md`
- **Lifecycle Scripts**: `jellyseerr_webhook_handler_START.js` (v2.2.1), `jellyseerr_webhook_handler_CLOSE.js` (v2.2.1)
- **Webhook Template**: `docs/JELLYSEERR_WEBHOOK_TEMPLATE.md`
- **Lifecycle Improvements**: `LIFECYCLE_IMPROVEMENTS_v2.2.1.md`

---

## **Version History**

### **v2.3.0** (2025-10-17) - **Current**

- ✅ Professional Logger Helper with `[Webhook Handler]` prefix
- ✅ Enhanced error context with diagnostic metadata
- ✅ Batch context operations for performance
- ✅ Cleaner log output with consistent formatting
- ✅ Full Node-RED Function Node best practices compliance

### **v2.2.0** (2025-10-17)

- Statistics tracking with context storage
- Per-event-type counters
- node.trace() debugging support

### **v2.1.1** (2025-10-17)

- Support for both issue.id and issue.issue_id

### **v2.1.0** (2025-10-17)

- Request ID in node status

### **v2.0.0** (2025-10-17)

- Try/catch error handling
- Enhanced status updates

### **v1.0.0** (Initial)

- Basic payload normalization

---

*The webhook handler now implements the same professional logging patterns as the lifecycle scripts, providing consistent, filterable logs across the entire Jellyseerr notification pipeline.* ✨
