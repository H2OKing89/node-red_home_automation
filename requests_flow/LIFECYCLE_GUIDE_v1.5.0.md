# TextBee SMS Handler v1.5.0 - Node-RED Lifecycle Guide

**Date**: 2025-10-15  
**Node-RED Best Practices**: Fully implemented

---

## What's New in v1.5.0

### 🎯 Production-Ready Lifecycle Management

This version implements **Node-RED's recommended lifecycle patterns** for production-grade Function nodes:

1. **Setup Tab (On Start)**: Configuration validation and state initialization
2. **Close Tab (On Stop)**: Graceful shutdown and memory cleanup
3. **Periodic Context Cleanup**: Automatic deduplication key expiration
4. **Statistics Tracking**: Session SMS counters and metrics
5. **Enhanced Debugging**: `node.trace()` for deep inspection

---

## 📋 Installation in Node-RED

### Step 1: Create/Open the Function Node

1. Drag a **Function** node onto your flow
2. Double-click to open the editor
3. Set **Name**: `Jellyseerr TextBee SMS`
4. Set **Timeout**: `30` seconds (on Setup tab)

### Step 2: Copy Main Code

1. Go to the **On Message** tab (default tab)
2. **Delete** any existing code
3. Copy entire contents of `jellyseerr_textbee_notify.js`
4. Paste into the editor

### Step 3: Add Setup Tab Code ⭐ NEW

1. Click the **Setup** tab (middle tab)
2. Copy entire contents of `jellyseerr_textbee_notify_SETUP.js`
3. Paste into the Setup tab

**What it does:**

- ✅ Validates `axios` is available
- ✅ Checks `TEXTBEE_CONFIG` exists
- ✅ Initializes SMS counter
- ✅ Sets "Ready" status indicator
- ✅ Logs startup timestamp

### Step 4: Add Close Tab Code ⭐ NEW

1. Click the **Close** tab (rightmost tab)
2. Copy entire contents of `jellyseerr_textbee_notify_CLOSE.js`
3. Paste into the Close tab

**What it does:**

- ✅ Logs session statistics (total SMS sent)
- ✅ Cleans up old deduplication keys (prevents memory leaks)
- ✅ Resets counters
- ✅ Logs shutdown timestamp

### Step 5: Deploy

Click **Deploy** (top-right) and watch the debug sidebar!

---

## 🔍 What You'll See

### On Deploy (Startup)

```
[info] axios available in global context
[info] TextBee SMS Handler initialized with 6 users
[info] SMS counter initialized to 0
[info] Deduplication cleanup timer initialized
[info] TextBee SMS Handler started at 2025-10-15T14:23:45.678Z
```

**Node Status**: 🟢 "Ready"

### During Operation

```
[info] Processing event: MEDIA_AVAILABLE
[debug] Looking up user by email: email="joe@example.com"
[debug] Normalized phone: 402-555-5555 → +14025555555
[info] Sending SMS to +14025555555 via TextBee
[info] TextBee API HTTP Status: 201
[info] SMS QUEUED for Joe Hawk (+14025555555) - ID: 68f0644bf90e25846fa7ef09
[debug] Total SMS sent this session: 3
```

**Node Status**: 🔵 "Queued: Joe Hawk"

### Periodic Cleanup (Every Hour)

```
[debug] Cleaned up 12 expired deduplication keys
```

### On Redeploy (Shutdown)

```
[info] TextBee SMS Handler stopping - Total SMS sent this session: 47
[info] Found 58 deduplication keys in context
[info] Cleaned up 12 old deduplication keys (older than 24 hours)
[info] TextBee SMS Handler stopped at 2025-10-15T18:45:32.123Z
[info] TextBee SMS Handler cleanup complete
```

**Node Status**: ⚫ (cleared)

---

## 🧹 Memory Management

### Automatic Cleanup

**Periodic** (every hour while running):

- Cleans deduplication keys older than 2× squelch window
- Default: keys older than 120 seconds removed
- Logs cleanup count if any removed

**On Shutdown**:

- Cleans deduplication keys older than 24 hours
- Logs statistics (total keys, cleaned count)
- Resets all counters

### Manual Inspection

You can check context storage in Node-RED:

1. Open **Context Data** sidebar (View → Context Data)
2. Navigate to your Function node
3. View `sms_sent_count`, `last_cleanup`, and dedupe keys

---

## 📊 Statistics & Monitoring

### Available Metrics

| Metric | Context Key | Type | Description |
|--------|-------------|------|-------------|
| **SMS Sent** | `sms_sent_count` | number | Total SMS sent this session |
| **Last Cleanup** | `last_cleanup` | timestamp | Last deduplication cleanup time |
| **Dedupe Keys** | `EVENT:id` | timestamp | Per-event deduplication timestamps |

### Accessing Statistics

**In Debug Sidebar** (automatic):

- Startup logs show initialization
- Each SMS logs incremented counter
- Shutdown logs show session totals

**Via Flow Context** (programmatic):

```javascript
// In another Function node
const stats = {
    smsSent: flow.get("textbee_node.sms_sent_count"),
    lastCleanup: flow.get("textbee_node.last_cleanup")
};
msg.payload = stats;
return msg;
```

---

## 🐛 Enhanced Debugging

### Debug Levels

| Level | Method | Use Case | Example |
|-------|--------|----------|---------|
| **Info** | `node.log()` | Important events | SMS sent, user matched |
| **Warn** | `node.warn()` | Expected failures | User not in config |
| **Error** | `node.error()` | Unexpected errors | API failures |
| **Debug** | `node.debug()` | Development details | Phone normalization |
| **Trace** | `node.trace()` | Deep inspection | Full API payloads |

### Enabling Trace Logs

1. Open Node-RED **Settings** (top-right menu)
2. Enable **Trace** level in debug sidebar filter
3. Or set environment: `NODE_RED_LOG_LEVEL=trace`

**Trace Output Examples**:

```
[trace] Normalized: email="joe@example.com", username="joe hawk"
[trace] TextBee full request payload: { "recipients": ["+14025555555"], ... }
[trace] TextBee raw response: { "data": { "success": true, ... } }
```

---

## 🔄 Lifecycle Diagram

```
┌─────────────────────────────────────────────┐
│         Node-RED Flow Deploy                │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  SETUP TAB (On Start)                       │
│  - Validate axios                           │
│  - Check TEXTBEE_CONFIG                     │
│  - Initialize counters (sms_sent_count=0)   │
│  - Set node status: "Ready"                 │
│  - Log startup timestamp                    │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  MAIN TAB (On Message)                      │
│  ┌────────────────────────────────────┐    │
│  │ Process incoming webhook            │    │
│  │ Check duplicate squelch             │    │
│  │ Periodic cleanup (every hour)       │    │
│  │ Look up user                        │    │
│  │ Generate SMS message                │    │
│  │ Send via TextBee API                │    │
│  │ Track statistics (sms_sent_count++) │    │
│  │ Set node status                     │    │
│  │ Send message downstream             │    │
│  └────────────────────────────────────┘    │
│               │                              │
│               └──────┐ (loop for each msg)  │
│                      │                       │
└──────────────────────┼───────────────────────┘
                       │
                       ▼
            (runs until redeploy)
                       │
                       ▼
┌─────────────────────────────────────────────┐
│         Node-RED Flow Redeploy/Stop         │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  CLOSE TAB (On Stop)                        │
│  - Log session statistics                   │
│  - Clean old dedupe keys (>24h)             │
│  - Reset counters                           │
│  - Log shutdown timestamp                   │
│  - Clear node status                        │
└─────────────────────────────────────────────┘
```

---

## 🎛️ Configuration Options

### Duplicate Squelch Window

Add to your `TEXTBEE_CONFIG`:

```json
{
  "duplicate_squelch_ms": 120000  // 2 minutes (default is 60s)
}
```

**Cleanup interval** is always **2× the squelch window**.

### Statistics Persistence

By default, statistics reset on redeploy. To persist across restarts:

1. Configure **context storage** in `settings.js`:

```javascript
contextStorage: {
    default: "memoryOnly",
    file: { module: 'localfilesystem' }
}
```

2. Store stats to file context:

```javascript
context.set("sms_sent_count", count, "file");
```

---

## 📈 Production Best Practices

### 1. Monitor Statistics

Set up a **Status** node or dashboard to track:

- SMS sent per hour/day
- Deduplication key count (memory usage)
- Error rates from Catch nodes

### 2. Alert on Issues

Connect a **Catch** node to your notification system:

```
[TextBee SMS] → [Catch] → [Pushover/Discord Alert]
```

### 3. Log Rotation

For high-volume deployments:

- Enable file-based context storage
- Set up log rotation in Node-RED
- Monitor context storage size

### 4. Backup & Recovery

Export your flow regularly:

- Menu → Export → Current Tab
- Store `jellyseerr_textbee_notify_*.js` files in version control
- Document your `TEXTBEE_CONFIG` structure

---

## 🔧 Troubleshooting

### "Config missing" on startup

**Symptom**: Red status, error in logs

**Check**:

1. `TEXTBEE_CONFIG` is set in `settings.js` **OR** Node-RED env vars
2. Restart Node-RED after editing `settings.js`
3. Verify JSON syntax (use validator)

### "axios missing" on startup

**Symptom**: Yellow status, warning in logs

**Fix**:

```javascript
// In settings.js
functionGlobalContext: {
    axios: require('axios')
}
```

Then restart Node-RED.

### Memory leak (context growing)

**Symptom**: Context Data sidebar shows hundreds of keys

**Cause**: Periodic cleanup not running or disabled

**Fix**:

1. Verify Setup/Close tabs are populated
2. Check logs for "Cleaned up X keys"
3. Manually trigger cleanup by redeploying

### Statistics not resetting

**Symptom**: `sms_sent_count` keeps growing across deploys

**Cause**: Using file-based context storage

**Fix**: Use memory-only storage or manually reset:

```javascript
context.set("sms_sent_count", 0);
```

---

## 📚 Additional Resources

- [Node-RED Function Node Guide](../docs/function_node/node_red_function_node_practical_guide.md)
- [Main TextBee Documentation](./docs/README.md)
- [Setup Guide](./docs/TEXTBEE_SETUP.md)
- [Changelog v1.4.0](./CHANGELOG_v1.4.0.md)

---

## 🎉 Summary

**v1.5.0 adds production-grade lifecycle management:**

✅ Setup tab validates config on startup  
✅ Close tab cleans up memory on shutdown  
✅ Periodic cleanup prevents memory leaks  
✅ Statistics tracking for monitoring  
✅ Enhanced debugging with `node.trace()`  
✅ Automatic deduplication key expiration  

**Result: Production-ready, memory-efficient, observable SMS notifications! 🚀**

---

**Next Steps**:

1. Copy code into Node-RED (all 3 tabs)
2. Deploy and watch startup logs
3. Test with webhook injection
4. Monitor statistics in debug sidebar
5. Check context data after 1 hour (cleanup should run)
