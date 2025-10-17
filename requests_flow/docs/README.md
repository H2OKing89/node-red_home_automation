# Jellyseerr TextBee SMS Notifications

**Complete technical reference for SMS notifications via TextBee API**

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Supported Events](#supported-events)
- [User Mapping](#user-mapping)
- [Message Templates](#message-templates)
- [Architecture](#architecture)
- [API Response Handling](#api-response-handling)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

---

## Overview

The `jellyseerr_textbee_notify.js` Function node sends **targeted SMS notifications** via the TextBee API when Jellyseerr webhook events occur. Unlike broadcast TTS notifications, this intelligently maps Jellyseerr users to phone numbers and only notifies the specific users involved in each request or issue.

### Key Features

- **🎯 Targeted Notifications**: Only notifies users directly involved (requestor, issue reporter)
- **👤 Smart User Mapping**: Automatically maps Jellyseerr users by email or username to phone numbers
- **📝 Template System**: Customizable SMS message templates with emoji support
- **⚙️ Preferred Contact**: Respects user's `preferred_contact` setting
- **✅ Response Validation**: Validates TextBee API responses and tracks delivery status
- **📊 Status Updates**: Visual node status indicators (🔵 blue = processing, 🟢 green = success, 🔴 red = error)
- **🐛 Debug Logging**: Comprehensive logging for troubleshooting

### What's Different from TTS?

| Feature | TTS Handler | TextBee SMS Handler |
|---------|-------------|---------------------|
| **Audience** | 📢 Everyone (all speakers) | 👤 Specific user only |
| **Medium** | 🔊 Voice announcement | 📱 Text message |
| **Delivery** | 🏠 Immediate (in home) | 🌍 Immediate (anywhere) |
| **Targeting** | Broadcasts to all | Maps user → phone |

---

## Quick Start

### 1. Install Dependencies

Ensure `axios` is available in Node-RED `settings.js`:

```javascript
functionGlobalContext: {
    axios: require('axios')
}
```

### 2. Configure TextBee

See [Configuration](#configuration) section below for complete setup.

### 3. Import Function Node

1. Copy `jellyseerr_textbee_notify.js`
2. Import into Node-RED (Menu → Import → Clipboard)
3. Set timeout to **30 seconds** in Setup tab

### 4. Wire Into Flow

```
[jellyseerr_webhook_handler.js]
    ↓
[jellyseerr_textbee_notify.js] ← Add this
    ↓
[HTTP Response / Debug]
```

### 5. Test

Create an Inject node with test payload:

```json
{
  "payload": {
    "notification_type": "MEDIA_AVAILABLE",
    "subject": "The Matrix",
    "request": {
      "requestedBy_email": "user@example.com",
      "requestedBy_username": "Test User"
    }
  }
}
```

**For detailed setup instructions, see [TEXTBEE_SETUP.md](./TEXTBEE_SETUP.md)**

---

## Configuration

### Option A: Node-RED Environment Variables (Recommended)

1. Go to **Menu → Settings → Function nodes → Environment Variables**
2. Click **+ Add**
3. Set:
   - **Name**: `TEXTBEE_CONFIG`
   - **Type**: `json`
   - **Value**: (see example below)

### Option B: settings.js Global Context

Edit `~/.node-red/settings.js`:

```javascript
module.exports = {
    functionGlobalContext: {
        axios: require('axios'),
        
        // Direct JavaScript object (RECOMMENDED)
        TEXTBEE_CONFIG: {
            textbee: {
                base_url: "https://api.textbee.dev",
                device_id: "YOUR_DEVICE_ID",
                api_key: "YOUR_API_KEY",
                send_path_template: "/api/v1/gateway/devices/{deviceId}/send-sms",
                timeout_ms: 5000,
                max_retries: 3,
                default_sender: null
            },
            jellyseerr_lookup_by: "email",
            users: [
                {
                    jellyseerr_email: "user@example.com",
                    jellyseerr_username: "User Name",
                    name: "User Name",
                    phone: "+14025551234",
                    preferred_contact: "sms"
                }
            ],
            templates: {
                request_added: "🎬 Hey {name}! Your request for \"{title}\" just made it into the Jellyseerr queue. Pop some popcorn — it's waiting for approval! 🍿",
                request_approved: "✅ Great news, {name}! Your request for \"{title}\" got the green light and is downloading faster than a caffeinated server. ⚡️",
                request_declined: "🚫 Sorry, {name} — your request for \"{title}\" got a thumbs-down from the media gods. Maybe bribe the admin with cookies? 🍪",
                request_ready: "📺 It's showtime, {name}! \"{title}\" is now live and ready to stream. Grab your snacks and hit play! 🎉",
                request_failed: "💥 Uh-oh, {name} — \"{title}\" tripped over a digital banana peel on its way in. Check Jellyseerr for details and we'll fix it up soon!"
            },
            logging: {
                level: "info"
            }
        }
    }
}
```

**Then restart Node-RED**: `sudo systemctl restart nodered`

### Configuration Fields

#### TextBee API Settings

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `base_url` | string | Yes | TextBee API base URL (`https://api.textbee.dev`) |
| `device_id` | string | Yes | Your TextBee gateway device ID |
| `api_key` | string | Yes | TextBee API authentication key |
| `send_path_template` | string | Yes | API endpoint path template |
| `timeout_ms` | number | No | Request timeout (default: 5000ms) |
| `max_retries` | number | No | Max retry attempts (default: 3) |
| `default_sender` | string | No | Default sender name/number |

#### User Mapping

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jellyseerr_email` | string | Yes* | User's Jellyseerr email address |
| `jellyseerr_username` | string | Yes* | User's Jellyseerr username |
| `name` | string | Yes | Friendly name for SMS personalization |
| `phone` | string | Yes | Phone number in E.164 format (`+1XXXXXXXXXX`) |
| `preferred_contact` | string | No | Contact method (`"sms"`, `"push"`, etc.) |

*At least one of `jellyseerr_email` or `jellyseerr_username` required

#### Lookup Strategy

- `jellyseerr_lookup_by`: `"email"` or `"username"` (default: `"email"`)
- Primary matching field, falls back to secondary if no match

---

## Supported Events

| Event Type | Notifies | Template Key | Default Message |
|------------|----------|--------------|-----------------|
| `MEDIA_PENDING` | Requester | `request_added` | 🎬 Request added to queue 🍿 |
| `MEDIA_AUTO_APPROVED` | Requester | `request_approved` | ✅ Request approved, downloading ⚡️ |
| `MEDIA_APPROVED` | Requester | `request_approved` | ✅ Request approved, downloading ⚡️ |
| `MEDIA_DECLINED` | Requester | `request_declined` | 🚫 Request declined 🍪 |
| `MEDIA_AVAILABLE` | Requester | `request_ready` | 📺 Ready to stream 🎉 |
| `MEDIA_FAILED` | Requester | `request_failed` | 💥 Download failed (banana peel) |
| `ISSUE_CREATED` | Reporter | `issue_created` | Issue reported by {username} |
| `ISSUE_COMMENT` | Reporter | `issue_comment` | {username} commented on issue |
| `ISSUE_RESOLVED` | Reporter | `issue_resolved` | Issue resolved |
| `ISSUE_REOPENED` | Reporter | `issue_reopened` | Issue reopened |

---

## User Mapping

### How User Targeting Works

**Request Events** (`MEDIA_*`): Notifies the **requester**

```javascript
targetEmail = payload.request.requestedBy_email;
targetUsername = payload.request.requestedBy_username;
```

**Issue Events** (`ISSUE_*`): Notifies the **issue reporter** (not the commenter)

```javascript
targetEmail = payload.issue.reportedBy_email;
targetUsername = payload.issue.reportedBy_username;
```

### Lookup Process

1. **Extract identifiers** from webhook payload (email/username)
2. **Search config** using primary field (`jellyseerr_lookup_by`)
3. **Fallback** to secondary field if no match
4. **Return user** with phone number and preferences

### Filtering Logic

SMS is **skipped** if:

- ❌ User not found in config
- ❌ User has no `phone` field
- ❌ User's `preferred_contact` is not `"sms"` (unless not set)
- ❌ Event type not in `SMS_EVENTS` list

---

## Message Templates

### Template Placeholders

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{name}` | User's `name` from config | "Quentin King" |
| `{title}` | Media title from `subject` or `media.title` | "The Matrix" |
| `{username}` | Jellyseerr username of requester/reporter | "qking.dev" |
| `{issue_type}` | Issue type from payload | "Video Quality" |

### Current Templates (v1.3.0)

```json
{
  "request_added": "🎬 Hey {name}! Your request for \"{title}\" just made it into the Jellyseerr queue. Pop some popcorn — it's waiting for approval! 🍿",
  
  "request_approved": "✅ Great news, {name}! Your request for \"{title}\" got the green light and is downloading faster than a caffeinated server. ⚡️",
  
  "request_declined": "🚫 Sorry, {name} — your request for \"{title}\" got a thumbs-down from the media gods. Maybe bribe the admin with cookies? 🍪",
  
  "request_ready": "📺 It's showtime, {name}! \"{title}\" is now live and ready to stream. Grab your snacks and hit play! 🎉",
  
  "request_failed": "💥 Uh-oh, {name} — \"{title}\" tripped over a digital banana peel on its way in. Check Jellyseerr for details and we'll fix it up soon!"
}
```

### Example Output

**Input**: `MEDIA_AVAILABLE` event for "The Matrix" requested by Quentin

**Output**:

```
📺 It's showtime, Quentin King! "The Matrix" is now live and ready to stream. Grab your snacks and hit play! 🎉
```

---

## Architecture

### Flow Diagram

```
┌─────────────────┐
│  Jellyseerr     │
│   Webhook       │
└────────┬────────┘
         │ HTTPS POST
         ▼
┌─────────────────┐
│  auth_gate.js   │ ◄── Validates Authorization header
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ jellyseerr_webhook_     │ ◄── Normalizes payload structure
│ handler.js              │
└────────┬────────────────┘
         │
         ├────────────────┐
         │                │
         ▼                ▼
┌──────────────┐  ┌────────────────────┐
│ TTS Handler  │  │ TextBee SMS        │ ◄── Targeted notifications
│ (Broadcast)  │  │ Handler            │
└──────────────┘  └────────┬───────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ TextBee API     │
                  │ (SMS Gateway)   │
                  └─────────────────┘
```

### Processing Flow

1. **Webhook Received**: Jellyseerr sends POST to Node-RED endpoint
2. **Authentication**: `auth_gate.js` validates request
3. **Normalization**: `jellyseerr_webhook_handler.js` ensures payload structure
4. **Event Check**: Handler checks if event is in `SMS_EVENTS` list
5. **User Lookup**: Finds user by email/username in config
6. **Preference Check**: Verifies `preferred_contact` is `"sms"`
7. **Message Generation**: Applies template with placeholder replacement
8. **API Call**: Posts to TextBee API with axios
9. **Response Validation**: Checks HTTP status and SMS status
10. **Status Update**: Updates node visual indicator
11. **Result Tracking**: Attaches `msg.textbee_result` for downstream processing

---

## API Response Handling

### TextBee Response Structure

TextBee uses a **batch-based SMS system** with this response format:

```json
{
  "data": {
    "success": true,
    "message": "SMS added to queue for processing",
    "smsBatchId": "68f0644bf90e25846fa7ef09",
    "recipientCount": 1
  }
}
```

### Status Inference Logic

Since TextBee doesn't return explicit `status` field, we **infer** it:

```javascript
if (success === true) {
    if (message.includes('queue')) {
        status = 'QUEUED'  // SMS accepted, waiting to send
    } else if (message.includes('sent')) {
        status = 'SENT'    // SMS sent to carrier
    } else {
        status = 'ACCEPTED' // SMS accepted by API
    }
}
```

### Status Values

| Status | Meaning | Node Indicator | Action |
|--------|---------|----------------|--------|
| `QUEUED` | Queued for delivery | 🔵 "Queued: User" | Log info, continue |
| `ACCEPTED` | Accepted by API | 🔵 "Queued: User" | Log info, continue |
| `SENT` | Sent to carrier | 🟢 "Sent: User" | Log info, success |
| `DELIVERED` | Confirmed delivered | 🟢 "Delivered: User" | Log info, success |
| `FAILED` | Delivery failed | 🔴 "Error: SMS FAILED" | Throw error |
| `REJECTED` | Rejected by API | 🔴 "Error: SMS REJECTED" | Throw error |
| `UNKNOWN` | Status not returned | 🟡 "Sent: User (status unknown)" | Log warning, continue |

### msg.textbee_result Structure

```javascript
msg.textbee_result = {
    success: true,
    user: "Quentin King",
    phone: "+14026131234",
    message: "📺 It's showtime, Quentin King! ...",
    event: "MEDIA_AVAILABLE",
    sms_id: "68f0644bf90e25846fa7ef09",    // TextBee batch ID
    sms_status: "QUEUED",                   // Inferred status
    created_at: "2025-10-15T22:19:39Z",
    api_response: {
        success: true,
        message: "SMS added to queue for processing",
        smsBatchId: "68f0644bf90e25846fa7ef09",
        recipientCount: 1
    }
};
```

### Expected Log Output

```
[info] Processing event: MEDIA_APPROVED
[info] Sending SMS to +14025606154 via TextBee
[info] TextBee API HTTP Status: 201
[info] TextBee full response: {"data":{"success":true,...}}
[debug] Inferred status from TextBee response: QUEUED
[info] SMS status: QUEUED (ID: 68f0644bf90e25846fa7ef09)
[info] SMS QUEUED for Joe Hawk (+14025606154)
```

---

## Troubleshooting

### Common Issues

#### 1. "Config load failed" 🔴

**Symptoms**: Red node status with "Config load failed"

**Causes**:

- `TEXTBEE_CONFIG` not set in environment or `settings.js`
- Invalid JSON syntax in config
- Node-RED not restarted after `settings.js` changes

**Fixes**:

```bash
# Verify config exists in settings.js
grep -A 5 "TEXTBEE_CONFIG" ~/.node-red/settings.js

# Validate JSON syntax
# Use JSONLint.com or similar

# Restart Node-RED
sudo systemctl restart nodered
```

#### 2. "User not in config" 🟡

**Symptoms**: Yellow node status, no SMS sent

**Causes**:

- Jellyseerr email/username doesn't match config
- Case sensitivity mismatch
- Wrong `jellyseerr_lookup_by` setting

**Fixes**:

1. Check debug logs for searched email/username:

   ```
   [debug] Looking up user by email: email="user@example.com", username="User Name"
   [warn] No user found for email="user@example.com", username="User Name"
   ```

2. Verify exact match in config:

   ```json
   {
     "jellyseerr_email": "user@example.com",  // Must match exactly
     "jellyseerr_username": "User Name"
   }
   ```

3. Try switching lookup strategy:

   ```json
   "jellyseerr_lookup_by": "username"  // Instead of "email"
   ```

#### 3. "axios not available" 🔴

**Symptoms**: Error: "axios not available in global context"

**Fix**:

```javascript
// Add to settings.js
functionGlobalContext: {
    axios: require('axios')
}
```

Then restart Node-RED.

#### 4. "No phone number" 🟡

**Symptoms**: Yellow node status, logs show "User X has no phone number configured"

**Fix**:

```json
{
  "users": [{
    "phone": "+14025551234"  // Add E.164 format phone
  }]
}
```

#### 5. SMS Not Received 📱

**Check**:

1. ✅ TextBee API credentials correct (`device_id`, `api_key`)
2. ✅ Phone number in E.164 format (`+1` prefix for US/Canada)
3. ✅ TextBee gateway device online (check dashboard)
4. ✅ Node status shows green/blue (not red/yellow)
5. ✅ Check TextBee dashboard for delivery status
6. ✅ Review debug logs for API errors

**TextBee Dashboard**: Log into [textbee.dev](https://textbee.dev), search for batch ID from logs

#### 6. "Event not SMS-enabled" ⚫

**Symptoms**: Grey node status

**Cause**: Event type not in `SMS_EVENTS` array

**Fix**: Add event to array in function code:

```javascript
const SMS_EVENTS = [
    "MEDIA_AUTO_APPROVED",
    "MEDIA_APPROVED",
    "MEDIA_AVAILABLE",
    "MEDIA_PENDING",
    "MEDIA_DECLINED",  // Add new events here
    "MEDIA_FAILED",
    // ...
];
```

### Debug Logging

Enable detailed logging (already enabled by default):

```javascript
const LOGGING_ENABLED = true;  // Line 47 in function code
```

**Log Levels**:

- `node.log()` - Important automation events
- `node.warn()` - Expected conditions preventing automation
- `node.debug()` - Non-critical flow control info (enable debug in sidebar)
- `node.error()` - Unexpected errors needing attention

**Check Debug Sidebar** for:

- User lookup results
- Template generation
- API requests/responses
- Status inference details

---

## Advanced Usage

### Downstream Processing

Use `msg.textbee_result` for audit trails, monitoring, or retry logic:

```javascript
// Function node after TextBee handler
if (msg.textbee_result && msg.textbee_result.success) {
    const audit = {
        timestamp: msg.textbee_result.created_at,
        user: msg.textbee_result.user,
        phone: msg.textbee_result.phone,
        event: msg.textbee_result.event,
        sms_id: msg.textbee_result.sms_id,
        status: msg.textbee_result.sms_status
    };
    
    // Store in database, send to monitoring, etc.
    return { payload: audit };
}
```

### Selective Event Routing

Use a Switch node to route different events:

```
[webhook_handler]
    ↓
[Switch: msg.payload.notification_type]
    ├─→ "MEDIA_AVAILABLE" → TextBee + TTS
    ├─→ "MEDIA_APPROVED" → TextBee only
    ├─→ "ISSUE_*" → TextBee only
    └─→ default → TTS only
```

### Multi-Contact Preferences

Users can have different notification preferences:

```json
{
  "users": [
    {
      "name": "Quentin",
      "preferred_contact": "sms",  // Gets SMS
      "phone": "+14026131234"
    },
    {
      "name": "Betty",
      "preferred_contact": "push",  // Skips SMS
      "phone": "+14024305350"
    }
  ]
}
```

### Error Handling with Catch Node

Connect a Catch node to handle API failures:

```javascript
// Catch node
if (msg.error && msg.error.message.includes("FAILED")) {
    const alert = {
        level: "error",
        message: `SMS delivery failed for ${msg.textbee_result.user}`,
        sms_id: msg.textbee_result.sms_id,
        phone: msg.textbee_result.phone
    };
    
    // Send to alerting system (Pushover, Discord, etc.)
    return { payload: alert };
}
```

### Custom Templates Per Event

Customize messages for different scenarios:

```json
{
  "templates": {
    "request_added": "🎬 Hey {name}! Your request for \"{title}\" is in the queue! 🍿",
    "request_approved": "✅ {name}, \"{title}\" is downloading now! ⚡️",
    "request_declined": "🚫 Sorry {name}, \"{title}\" was declined. 🍪",
    "request_ready": "📺 {name}, \"{title}\" is ready to watch! 🎉",
    "request_failed": "💥 {name}, \"{title}\" failed to download!",
    "issue_created": "⚠️ {name}, an issue was reported for \"{title}\" by {username}",
    "issue_comment": "💬 {name}, {username} commented on \"{title}\" issue",
    "issue_resolved": "✅ {name}, the issue for \"{title}\" is resolved!",
    "issue_reopened": "🔄 {name}, the issue for \"{title}\" was reopened"
  }
}
```

---

## Version History

- **v1.3.0** (2025-10-15): Added `MEDIA_DECLINED` support, fun emoji templates
- **v1.2.1** (2025-10-15): Improved fallback defaults for all event types
- **v1.2.0** (2025-10-15): Native TextBee response format support, status inference
- **v1.1.2** (2025-10-15): Enhanced debug logging for response inspection
- **v1.1.1** (2025-10-15): Multiple response structure pattern support
- **v1.1.0** (2025-10-15): Response validation and status tracking
- **v1.0.1** (2025-10-15): Dual config loading (env + global)
- **v1.0.0** (2025-10-15): Initial implementation

---

## See Also

- [TEXTBEE_SETUP.md](./TEXTBEE_SETUP.md) - Detailed setup guide with step-by-step instructions
- [../../README.md](../../README.md) - Overall project documentation
- [TextBee API Documentation](https://api.textbee.dev/docs) - Official TextBee API reference
- [Jellyseerr Webhooks](https://docs.jellyseerr.dev) - Jellyseerr webhook configuration

---

**Questions or issues?** Check the [Troubleshooting](#troubleshooting) section or review debug logs in Node-RED sidebar.
