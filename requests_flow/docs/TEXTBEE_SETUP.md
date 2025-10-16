# TextBee SMS Setup Guide

## Quick Start

This guide walks you through setting up **targeted SMS notifications** for Jellyseerr events using the TextBee API. Unlike TTS broadcasts, SMS notifications only go to the specific users involved in each request or issue.

**For complete technical documentation, see [README.md](./README.md)**

## Prerequisites

- [ ] Node-RED instance running (v1.0+)
- [ ] TextBee account with API access
- [ ] TextBee gateway device configured
- [ ] Jellyseerr webhook configured
- [ ] `axios` available in Node-RED global context

## Step 1: Configure TextBee API

1. **Get TextBee Credentials**:
   - Log in to [TextBee Dashboard](https://textbee.dev)
   - Navigate to your gateway device
   - Copy your **Device ID**
   - Generate/copy your **API Key**

2. **Test API Access** (optional):

   ```bash
   curl -X POST "https://api.textbee.dev/api/v1/gateway/devices/YOUR_DEVICE_ID/send-sms" \
     -H "x-api-key: YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "recipients": ["+14025551234"],
       "message": "Test from TextBee API"
     }'
   ```

## Step 2: Configure Node-RED Environment

### Option A: Via settings.js (Recommended)

Edit `~/.node-red/settings.js`:

```javascript
module.exports = {
    // ... other settings ...
    
    functionGlobalContext: {
        // Required: axios for HTTP requests
        axios: require('axios'),
        
        // Add TEXTBEE_CONFIG as stringified JSON
        TEXTBEE_CONFIG: JSON.stringify({
            "textbee": {
                "base_url": "https://api.textbee.dev",
                "device_id": "YOUR_DEVICE_ID",
                "api_key": "YOUR_API_KEY",
                "send_path_template": "/api/v1/gateway/devices/{deviceId}/send-sms",
                "timeout_ms": 5000,
                "max_retries": 3,
                "default_sender": null
            },
            "jellyseerr_lookup_by": "email",
            "users": [
                {
                    "jellyseerr_email": "user@example.com",
                    "jellyseerr_username": "User Name",
                    "name": "User Name",
                    "phone": "+14025551234",
                    "preferred_contact": "sms"
                }
            ],
            "templates": {
                "request_added": "🎬 Hey {name}! Your request for \"{title}\" just made it into the Jellyseerr queue. Pop some popcorn — it's waiting for approval! 🍿",
                "request_approved": "✅ Great news, {name}! Your request for \"{title}\" got the green light and is downloading faster than a caffeinated server. ⚡️",
                "request_declined": "🚫 Sorry, {name} — your request for \"{title}\" got a thumbs-down from the media gods. Maybe bribe the admin with cookies? 🍪",
                "request_ready": "📺 It's showtime, {name}! \"{title}\" is now live and ready to stream. Grab your snacks and hit play! 🎉",
                "request_failed": "💥 Uh-oh, {name} — \"{title}\" tripped over a digital banana peel on its way in. Check Jellyseerr for details and we'll fix it up soon!"
            },
            "logging": {
                "level": "info"
            }
        })
    }
}
```

**Then restart Node-RED**:

```bash
# Using systemd
sudo systemctl restart nodered

# Using pm2
pm2 restart node-red

# Using Docker
docker restart node-red
```

### Option B: Via Node-RED UI (Alternative)

1. Open Node-RED editor
2. Go to **Menu → Settings → Function nodes**
3. Scroll to **Environment Variables**
4. Click **+ Add**
5. Set:
   - **Name**: `TEXTBEE_CONFIG`
   - **Type**: `env.var`
   - **Value**: Paste JSON from `TEXTBEE_CONFIG_EXAMPLE.jsonc` (remove comments first)
6. Click **Save** and **Deploy**

## Step 3: Import Function Node

1. **Copy the function code**:
   - Open `jellyseerr_textbee_notify.js`
   - Copy entire contents

2. **Import into Node-RED**:
   - Menu → Import → Clipboard
   - Paste code
   - Or manually create Function node and paste code

3. **Configure Function node**:
   - **Name**: `Jellyseerr TextBee SMS`
   - **Setup Tab**:
     - **Timeout**: `30` seconds
     - **External Modules**: None required
   - **On Message Tab**: Paste function code

## Step 4: Wire Into Flow

Connect to your existing webhook flow:

```
[HTTP In: /requests-webhook]
    ↓
[auth_gate.js] ← Authentication
    ↓
[jellyseerr_webhook_handler.js] ← Normalize payload
    ↓
    ├─→ [jellyseerr_tts_notify.js] → TTS announcements
    │
    └─→ [jellyseerr_textbee_notify.js] → SMS notifications
            ↓
        [Debug] (optional)
```

## Step 5: User Mapping

### Get Jellyseerr User Information

1. Log in to Jellyseerr as admin
2. Go to **Settings → Users**
3. For each user, note their:
   - **Email address** (primary identifier)
   - **Username** (fallback identifier)

### Add Users to Config

Edit your `TEXTBEE_CONFIG` and add users:

```json
{
  "users": [
    {
      "jellyseerr_email": "actual.user@email.com",
      "jellyseerr_username": "Jellyseerr Display Name",
      "name": "Friendly Name",
      "phone": "+14025551234",
      "preferred_contact": "sms"
    }
  ]
}
```

**Phone Number Format**: E.164 international format

- USA: `+1` + area code + number → `+14025551234`
- UK: `+44` + number
- Canada: `+1` + area code + number

## Step 6: Configure Jellyseerr Webhook

1. **In Jellyseerr**:
   - Go to **Settings → Notifications → Webhook**
   - Click **Add Webhook**

2. **Webhook Settings**:
   - **Webhook URL**: `https://your-node-red-instance/requests-webhook`
   - **Authorization Header**: Your auth token (matches `auth_gate.js`)
   - **JSON Template**: Use the provided schema (see below)

3. **Enable Events**:
   - ✅ Media Requested
   - ✅ Media Approved
   - ✅ Media Available
   - ✅ Media Failed
   - ✅ Issue Created
   - ✅ Issue Comment
   - ✅ Issue Resolved

### Jellyseerr JSON Template

```json
{
  "notification_type": "{{notification_type}}",
  "event": "{{event}}",
  "subject": "{{subject}}",
  "message": "{{message}}",
  "image": "{{image}}",
  "{{media}}": {
    "media_type": "{{media_type}}",
    "tmdbId": "{{media_tmdbid}}",
    "tvdbId": "{{media_tvdbid}}",
    "status": "{{media_status}}",
    "status4k": "{{media_status4k}}"
  },
  "{{request}}": {
    "request_id": "{{request_id}}",
    "requestedBy_email": "{{requestedBy_email}}",
    "requestedBy_username": "{{requestedBy_username}}",
    "requestedBy_avatar": "{{requestedBy_avatar}}",
    "requestedBy_settings_discordId": "{{requestedBy_settings_discordId}}",
    "requestedBy_settings_telegramChatId": "{{requestedBy_settings_telegramChatId}}"
  },
  "{{issue}}": {
    "issue_id": "{{issue_id}}",
    "issue_type": "{{issue_type}}",
    "issue_status": "{{issue_status}}",
    "reportedBy_email": "{{reportedBy_email}}",
    "reportedBy_username": "{{reportedBy_username}}",
    "reportedBy_avatar": "{{reportedBy_avatar}}",
    "reportedBy_settings_discordId": "{{reportedBy_settings_discordId}}",
    "reportedBy_settings_telegramChatId": "{{reportedBy_settings_telegramChatId}}"
  },
  "{{comment}}": {
    "comment_message": "{{comment_message}}",
    "commentedBy_email": "{{commentedBy_email}}",
    "commentedBy_username": "{{commentedBy_username}}",
    "commentedBy_avatar": "{{commentedBy_avatar}}",
    "commentedBy_settings_discordId": "{{commentedBy_settings_discordId}}",
    "commentedBy_settings_telegramChatId": "{{commentedBy_settings_telegramChatId}}"
  },
  "{{extra}}": []
}
```

## Step 7: Test the Integration

### Test 1: Inject Node Test

1. Create an **Inject node**
2. Set payload to:

```json
{
  "payload": {
    "notification_type": "MEDIA_AVAILABLE",
    "subject": "Test Movie",
    "request": {
      "requestedBy_email": "your.email@example.com",
      "requestedBy_username": "Your Name"
    }
  }
}
```

3. Connect to `jellyseerr_textbee_notify.js`
4. Click inject
5. Check:
   - Node status indicator (should turn green)
   - Debug sidebar for logs
   - Your phone for SMS

### Test 2: Jellyseerr Test Notification

1. In Jellyseerr webhook settings
2. Click **Send Test Notification**
3. Monitor Node-RED debug sidebar
4. Verify webhook received and processed

### Test 3: Live Request

1. Request media in Jellyseerr
2. Wait for event to trigger
3. Check SMS received

## Troubleshooting

### Node Status: "Config load failed"

**Cause**: `TEXTBEE_CONFIG` not found or invalid

**Fix**:

1. Verify environment variable is set (Step 2)
2. Check JSON syntax (use validator)
3. Restart Node-RED after `settings.js` changes

### Node Status: "User not in config"

**Cause**: Jellyseerr user email/username doesn't match config

**Fix**:

1. Check Jellyseerr user's email address
2. Verify `jellyseerr_email` in config matches exactly
3. Try switching `jellyseerr_lookup_by` to `"username"`
4. Check debug logs for what was searched

### Node Status: "axios not available"

**Cause**: `axios` not in Node-RED global context

**Fix**:

```javascript
// Add to settings.js
functionGlobalContext: {
    axios: require('axios')
}
```

Then restart Node-RED.

### SMS Not Received

**Check**:

1. TextBee API credentials correct
2. Phone number in E.164 format
3. TextBee gateway online
4. Check TextBee dashboard for delivery status
5. Review Node-RED debug logs for API errors

### Debug Logging

Enable detailed logging:

```javascript
const LOGGING_ENABLED = true; // In function code
```

Check debug sidebar for:

- User lookup results
- Template generation
- API requests/responses

## Customization

### Custom Message Templates

Edit templates in `TEXTBEE_CONFIG`:

```json
{
  "templates": {
    "request_ready": "🎬 Hey {name}! \"{title}\" is ready to stream. Grab some popcorn! 🍿"
  }
}
```

**Available placeholders**:

- `{name}` - User's friendly name
- `{title}` - Media title
- `{username}` - Requester/reporter username
- `{issue_type}` - Issue type

### Selective Notifications

Use a **Switch node** before TextBee handler:

```
[webhook_handler]
    ↓
[Switch: msg.payload.notification_type]
    ├─→ "MEDIA_AVAILABLE" → [TextBee SMS]
    ├─→ "MEDIA_PENDING" → [TTS only]
    └─→ default → [Both]
```

### Multi-Channel Notifications

User's `preferred_contact` determines routing:

```json
{
  "users": [
    {
      "name": "SMS User",
      "preferred_contact": "sms",
      "phone": "+14025551234"
    },
    {
      "name": "Push User",
      "preferred_contact": "push"
      // No phone needed, SMS will be skipped
    }
  ]
}
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for secrets
3. **Enable authentication** on webhook endpoints
4. **Rotate API keys** periodically
5. **Monitor API usage** in TextBee dashboard
6. **Limit webhook access** to Jellyseerr IP if possible

## Next Steps

- [ ] Set up error notifications (Catch nodes)
- [ ] Add rate limiting for SMS
- [ ] Implement retry logic for failed API calls
- [ ] Create dashboard for SMS delivery status
- [ ] Set up monitoring/alerting for failures

## Resources

- [TextBee API Documentation](https://api.textbee.dev/docs)
- [Jellyseerr Webhook Guide](https://docs.jellyseerr.dev)
- [Node-RED Function Node Guide](../docs/function_node/node_red_function_node_practical_guide.md)
- [requests_flow README](./README.md)

## Support

If you encounter issues:

1. Check debug logs in Node-RED
2. Review TextBee API dashboard
3. Verify Jellyseerr webhook logs
4. Test with Inject node first
5. Compare with working TTS flow

---

**Version**: 1.0.0  
**Last Updated**: 2025-10-15
