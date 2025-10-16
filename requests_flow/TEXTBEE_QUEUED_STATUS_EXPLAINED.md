# Understanding TextBee "Queued" Status

**TL;DR**: "Queued" = ✅ **Success!** Your SMS is accepted and will be sent within seconds.

---

## Why Does It Always Show "Queued"?

TextBee uses an **asynchronous queue system** for SMS delivery:

```
1. Your webhook fires → Node-RED function runs
2. Function sends SMS to TextBee API
3. TextBee responds: HTTP 201 + "SMS added to queue for processing"
4. Function updates status: "✓ Queued: Joe Hawk"
5. Function completes and stops
```

**The SMS is then sent by TextBee** (usually within 1-10 seconds) but your Node-RED function has already finished executing.

---

## TextBee Response Format

```json
{
  "data": {
    "success": true,
    "message": "SMS added to queue for processing",
    "smsBatchId": "68f16f916a418a16ec89f4bb",
    "recipientCount": 1
  }
}
```

**Key points**:

- ✅ `success: true` = API accepted your SMS
- 📦 `"added to queue"` = TextBee will send it shortly
- 🆔 `smsBatchId` = Tracking ID for this SMS batch
- ⏱️ **No immediate delivery confirmation** (asynchronous)

---

## Status Meanings

| Status | Color | Meaning | Is It Success? |
|--------|-------|---------|----------------|
| **Queued** | 🟢 Green | TextBee accepted SMS, will send shortly | ✅ Yes |
| **Pending** | 🟢 Green | Same as Queued (alternative wording) | ✅ Yes |
| **Accepted** | 🟢 Green | SMS accepted by API | ✅ Yes |
| **Sent** | 🟢 Green | SMS handed off to carrier | ✅ Yes |
| **Delivered** | 🟢 Green | SMS confirmed delivered to phone | ✅ Yes |
| **Unknown** | 🟡 Yellow | Status unclear but no error | ⚠️ Maybe |
| **Failed** | 🔴 Red | SMS rejected or failed | ❌ No |
| **Error** | 🔴 Red | API error occurred | ❌ No |

---

## Why Status Doesn't Update to "Delivered"

**Node-RED Function Nodes Are "One-Shot"**:

```
Webhook fires → Function runs → SMS sent → Function ends
                                              ↑
                                         Status set here
                                         (then frozen)
```

Once the function completes (`node.done()`), it **stops** and the status stays at whatever was last set.

**To get delivery status, you would need:**

1. Store the `smsBatchId` in context/database
2. Create a separate scheduled flow (runs every 1 minute)
3. Poll TextBee's status API for each batch ID
4. Update a dashboard/database with delivery status

**This is complex and usually not needed** because:

- ✅ "Queued" means TextBee accepted it (99% chance of delivery)
- ✅ TextBee handles retries automatically
- ✅ Phone receives SMS within 1-10 seconds typically

---

## How to Verify SMS Actually Sent

### 1. Check Your Phone

The SMS should arrive within **1-10 seconds** of the "Queued" status.

### 2. Check Debug Logs

Look for this sequence:

```
[info] Processing event: MEDIA_AVAILABLE
[info] Sending SMS to +14025606154 via TextBee
[info] TextBee API HTTP Status: 201           ← Success!
[info] SMS status: QUEUED (ID: 68f16f...)     ← Accepted!
[info] SMS QUEUED for Joe Hawk                ← Will send!
```

**If you see HTTP 201 + QUEUED** = SMS was successfully queued! ✅

### 3. Check TextBee Dashboard

Log into TextBee's web dashboard to see:

- Message history
- Delivery confirmations
- Failed messages (if any)

---

## Common Concerns

### "But I want to see 'Delivered' status!"

**Two options**:

**Option A: Accept "Queued" = Success** (recommended)

- Simple, reliable
- Works with webhook architecture
- TextBee handles the rest
- This is what v1.6.1 does (shows green checkmark)

**Option B: Build Status Polling** (advanced)

- Create separate flow that polls TextBee API
- Store batch IDs in context/database
- Query status every 30-60 seconds
- Update external dashboard
- Much more complex, rarely worth it

### "What if the SMS fails?"

**TextBee handles this**:

1. If SMS fails at carrier level, TextBee retries
2. If retries fail, you can see failure in TextBee dashboard
3. For critical notifications, consider adding a **Catch node** in Node-RED:

   ```
   [TextBee Function] → [Catch Node] → [Alert Admin]
   ```

### "Can I track delivery rates?"

**Yes! Two approaches**:

**In TextBee Dashboard**:

- View sent/delivered/failed counts
- Filter by date range
- Export reports

**In Node-RED**:

- The function tracks `sms_sent_count` in context
- On Close tab, logs total session count
- You could send this to a time-series database

---

## v1.6.1 Changes

**What Changed**:

```javascript
// OLD (v1.6.0)
statusColor = "blue";  // Info color (confusing)

// NEW (v1.6.1)
statusColor = "green";  // Success color (clear)
statusText = `✓ Queued: ${user.name}`;  // Added checkmark
```

**Why**:

- "Queued" **IS success** with TextBee's async model
- Green + checkmark makes this visually clear
- No need to worry when you see "Queued"

---

## Summary

**When you see**:

```
Status: ✓ Queued: Joe Hawk (green dot)
```

**It means**:

1. ✅ SMS was accepted by TextBee API
2. ✅ HTTP 201 response received
3. ✅ Batch ID assigned: `68f16f916a418a16ec89f4bb`
4. ✅ SMS is in TextBee's send queue
5. ⏱️ Will be delivered within 1-10 seconds (typically)
6. 📱 Check your phone - it's probably already there!

**This is normal and expected behavior.** ✅

---

## Additional Resources

- **TextBee API Docs**: Check their documentation for status polling endpoints
- **Node-RED Context**: `context.get("sms_sent_count")` for session stats
- **Setup/Close Tabs**: See lifecycle management in v1.5.0+

---

**Last Updated**: v1.6.1 (October 16, 2025)
