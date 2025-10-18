# Jellyseerr Webhook Configuration Guide

**Version:** 1.0.0  
**Date:** 2025-10-17  
**Author:** Node-RED Home Automation Team

---

## 📋 Table of Contents

- [Overview](#overview)
- [Correct Webhook Template](#correct-webhook-template)
- [Common Mistakes to Avoid](#common-mistakes-to-avoid)
- [Example Payloads by Event Type](#example-payloads-by-event-type)
- [Jellyseerr Configuration Steps](#jellyseerr-configuration-steps)
- [Testing Your Webhook](#testing-your-webhook)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides the **correct webhook template** for Jellyseerr to ensure proper
integration with your Node-RED automation flows. Using the correct template prevents
issues with dynamic key names, missing fields, and inconsistent data structures.

### Why This Template Matters

- ✅ **Consistent data structure** - All downstream nodes can rely on predictable field names
- ✅ **Proper ID tracking** - Request and issue IDs are correctly formatted for status displays
- ✅ **Static keys** - No dynamic key names that change based on media type
- ✅ **Complete data** - All necessary fields for notifications, TTS, and SMS alerts

---

## Correct Webhook Template

Copy and paste this **exact template** into your Jellyseerr webhook configuration:

```json
{
  "notification_type": "{{notification_type}}",
  "event": "{{event}}",
  "subject": "{{subject}}",
  "message": "{{message}}",
  "image": "{{image}}",
  "media": {
    "media_type": "{{media_type}}",
    "tmdbId": "{{media_tmdbid}}",
    "tvdbId": "{{media_tvdbid}}",
    "status": "{{media_status}}",
    "status4k": "{{media_status4k}}"
  },
  "request": {
    "request_id": "{{request_id}}",
    "requestedBy_email": "{{requestedBy_email}}",
    "requestedBy_username": "{{requestedBy_username}}",
    "requestedBy_avatar": "{{requestedBy_avatar}}",
    "requestedBy_settings_discordId": "{{requestedBy_settings_discordId}}",
    "requestedBy_settings_telegramChatId": "{{requestedBy_settings_telegramChatId}}"
  },
  "issue": {
    "id": "{{issue_id}}",
    "issue_type": "{{issue_type}}",
    "issue_status": "{{issue_status}}",
    "reportedBy_email": "{{reportedBy_email}}",
    "reportedBy_username": "{{reportedBy_username}}",
    "reportedBy_avatar": "{{reportedBy_avatar}}",
    "reportedBy_settings_discordId": "{{reportedBy_settings_discordId}}",
    "reportedBy_settings_telegramChatId": "{{reportedBy_settings_telegramChatId}}"
  },
  "comment": {
    "comment_message": "{{comment_message}}",
    "commentedBy_email": "{{commentedBy_email}}",
    "commentedBy_username": "{{commentedBy_username}}",
    "commentedBy_avatar": "{{commentedBy_avatar}}",
    "commentedBy_settings_discordId": "{{commentedBy_settings_discordId}}",
    "commentedBy_settings_telegramChatId": "{{commentedBy_settings_telegramChatId}}"
  },
  "extra": []
}
```

### Key Features

| Field | Type | Purpose |
|-------|------|---------|
| `notification_type` | String | Event type (e.g., `MEDIA_AVAILABLE`, `MEDIA_APPROVED`) |
| `event` | String | Human-readable event description |
| `subject` | String | Media title or issue subject |
| `message` | String | Detailed message about the event |
| `image` | String | TMDB/TVDB image URL |
| `media` | Object | Media metadata (type, IDs, status) |
| `request` | Object | Request details and requester info |
| `issue` | Object | Issue details and reporter info |
| `comment` | Object | Comment details and commenter info |
| `extra` | Array | Additional metadata (reserved for future use) |

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Dynamic Key Names

**WRONG:**

```json
{
  "{{media}}": { ... },
  "{{request}}": { ... },
  "{{issue}}": { ... }
}
```

**Problem:** This creates keys like `"movie"`, `"tv"`, or empty strings instead of
consistent `"media"`, `"request"`, `"issue"` keys.

**RIGHT:**

```json
{
  "media": { ... },
  "request": { ... },
  "issue": { ... }
}
```

---

### ❌ Mistake 2: Wrong Issue ID Field Name

**WRONG:**

```json
"issue": {
  "issue_id": "{{issue_id}}"
}
```

**Problem:** The webhook handler looks for `issue.id`, not `issue.issue_id`. This breaks issue ID display in node status.

**RIGHT:**

```json
"issue": {
  "id": "{{issue_id}}"
}
```

---

### ❌ Mistake 3: Dynamic Array Key

**WRONG:**

```json
{
  "{{extra}}": []
}
```

**Problem:** Creates a key with the literal value of the `{{extra}}` variable instead of the key name `"extra"`.

**RIGHT:**

```json
{
  "extra": []
}
```

---

## Example Payloads by Event Type

### MEDIA_APPROVED

```json
{
  "notification_type": "MEDIA_APPROVED",
  "event": "Movie Request Approved",
  "subject": "The Matrix (1999)",
  "message": "Your request has been approved and will begin downloading soon.",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/abc123.jpg",
  "media": {
    "media_type": "movie",
    "tmdbId": "603",
    "tvdbId": "",
    "status": "PROCESSING",
    "status4k": "UNKNOWN"
  },
  "request": {
    "request_id": "150",
    "requestedBy_email": "user@example.com",
    "requestedBy_username": "JohnDoe",
    "requestedBy_avatar": "https://plex.tv/users/abc123/avatar",
    "requestedBy_settings_discordId": "123456789",
    "requestedBy_settings_telegramChatId": ""
  },
  "issue": {},
  "comment": {},
  "extra": []
}
```

---

### MEDIA_AVAILABLE

```json
{
  "notification_type": "MEDIA_AVAILABLE",
  "event": "Movie Request Now Available",
  "subject": "A House of Dynamite (2025)",
  "message": "When a single, unattributed missile is launched...",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/xyz789.jpg",
  "media": {
    "media_type": "movie",
    "tmdbId": "1290159",
    "tvdbId": "",
    "status": "AVAILABLE",
    "status4k": "UNKNOWN"
  },
  "request": {
    "request_id": "150",
    "requestedBy_email": "user@example.com",
    "requestedBy_username": "Betty King",
    "requestedBy_avatar": "https://plex.tv/users/xyz789/avatar",
    "requestedBy_settings_discordId": "",
    "requestedBy_settings_telegramChatId": ""
  },
  "issue": {},
  "comment": {},
  "extra": []
}
```

---

### ISSUE_CREATED

```json
{
  "notification_type": "ISSUE_CREATED",
  "event": "New Issue Reported",
  "subject": "Breaking Bad (2008)",
  "message": "A new issue has been reported for this title.",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/def456.jpg",
  "media": {
    "media_type": "tv",
    "tmdbId": "1396",
    "tvdbId": "81189",
    "status": "AVAILABLE",
    "status4k": "UNKNOWN"
  },
  "request": {},
  "issue": {
    "id": "42",
    "issue_type": "video",
    "issue_status": "open",
    "reportedBy_email": "user@example.com",
    "reportedBy_username": "JaneDoe",
    "reportedBy_avatar": "https://plex.tv/users/def456/avatar",
    "reportedBy_settings_discordId": "987654321",
    "reportedBy_settings_telegramChatId": ""
  },
  "comment": {},
  "extra": []
}
```

---

### ISSUE_COMMENT

```json
{
  "notification_type": "ISSUE_COMMENT",
  "event": "New Comment on Issue",
  "subject": "Breaking Bad (2008)",
  "message": "A new comment has been added to an issue.",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/def456.jpg",
  "media": {
    "media_type": "tv",
    "tmdbId": "1396",
    "tvdbId": "81189",
    "status": "AVAILABLE",
    "status4k": "UNKNOWN"
  },
  "request": {},
  "issue": {
    "id": "42",
    "issue_type": "video",
    "issue_status": "open",
    "reportedBy_email": "reporter@example.com",
    "reportedBy_username": "JaneDoe",
    "reportedBy_avatar": "https://plex.tv/users/def456/avatar",
    "reportedBy_settings_discordId": "987654321",
    "reportedBy_settings_telegramChatId": ""
  },
  "comment": {
    "comment_message": "I've checked and it's working fine for me.",
    "commentedBy_email": "admin@example.com",
    "commentedBy_username": "AdminUser",
    "commentedBy_avatar": "https://plex.tv/users/ghi789/avatar",
    "commentedBy_settings_discordId": "111222333",
    "commentedBy_settings_telegramChatId": ""
  },
  "extra": []
}
```

---

### MEDIA_DECLINED

```json
{
  "notification_type": "MEDIA_DECLINED",
  "event": "Movie Request Declined",
  "subject": "Terrible Movie (2020)",
  "message": "Your request has been declined by an administrator.",
  "image": "https://image.tmdb.org/t/p/w600_and_h900_bestv2/bad123.jpg",
  "media": {
    "media_type": "movie",
    "tmdbId": "999999",
    "tvdbId": "",
    "status": "UNKNOWN",
    "status4k": "UNKNOWN"
  },
  "request": {
    "request_id": "151",
    "requestedBy_email": "user@example.com",
    "requestedBy_username": "JohnDoe",
    "requestedBy_avatar": "https://plex.tv/users/abc123/avatar",
    "requestedBy_settings_discordId": "123456789",
    "requestedBy_settings_telegramChatId": ""
  },
  "issue": {},
  "comment": {},
  "extra": []
}
```

---

## Jellyseerr Configuration Steps

### Step 1: Access Webhook Settings

1. Log in to your Jellyseerr instance
2. Navigate to **Settings** → **Notifications** → **Webhook**
3. Enable the Webhook notification agent

---

### Step 2: Configure Webhook URL

**Webhook URL Format:**

```
https://your-node-red-domain.com:1880/endpoint/requests
```

**Example:**

```
https://node-red.kingpaging.com:1880/endpoint/requests
```

**Important Notes:**

- Replace `your-node-red-domain.com` with your actual Node-RED server address
- The endpoint `/endpoint/requests` must match your HTTP In node configuration in Node-RED
- Ensure your Node-RED server is accessible from your Jellyseerr instance
- If using authentication, configure it in the HTTP In node's auth settings

---

### Step 3: Configure Authorization (Optional but Recommended)

**Authorization Header:**

```
Authorization: your-secret-token-here
```

**Example:**

```
Authorization: ez%i2a#MN*hvG6Dm^5WthMS8&!Np9y7*
```

**Security Best Practices:**

- Use a strong, randomly generated token
- Store the token securely (environment variables or encrypted storage)
- Validate the token in your `auth_gate.js` Function node
- Never commit tokens to version control

---

### Step 4: Paste Webhook Template

1. In the **Webhook JSON Payload** field, paste the [Correct Webhook Template](#correct-webhook-template)
2. Ensure there are **no modifications** to the key names
3. Verify all `{{variables}}` are properly formatted

---

### Step 5: Enable Event Types

Select which events should trigger the webhook:

**Recommended Events:**

- ✅ **Media Requested**
- ✅ **Media Approved**
- ✅ **Media Auto-Approved**
- ✅ **Media Available**
- ✅ **Media Failed**
- ✅ **Media Declined**
- ✅ **Issue Reported**
- ✅ **Issue Comment**
- ✅ **Issue Resolved**
- ✅ **Issue Reopened**

**Optional Events:**

- ⚠️ **Test Notification** - Use for initial testing only

---

### Step 6: Save and Test

1. Click **Save Changes**
2. Click **Test** to send a test notification
3. Check your Node-RED debug panel for the incoming payload
4. Verify the `jellyseerr_webhook_handler` node shows: `✓ Normalized [ID: X]`

---

## Testing Your Webhook

### Method 1: Test Button in Jellyseerr

1. In Jellyseerr webhook settings, click **Test**
2. Check Node-RED debug panel for incoming message
3. Verify node status shows: `✓ Normalized [ID: test]`

---

### Method 2: Trigger Real Event

1. Request a movie/show in Jellyseerr
2. Approve the request (or wait for auto-approval)
3. Monitor Node-RED flow execution
4. Check notification outputs (SMS, TTS, push notifications)

---

### Method 3: Manual cURL Test

```bash
curl -X POST https://your-node-red-domain.com:1880/endpoint/requests \
  -H "Content-Type: application/json" \
  -H "Authorization: your-secret-token-here" \
  -d '{
    "notification_type": "MEDIA_AVAILABLE",
    "event": "Movie Request Now Available",
    "subject": "Test Movie (2025)",
    "message": "This is a test webhook.",
    "image": "https://example.com/image.jpg",
    "media": {
      "media_type": "movie",
      "tmdbId": "12345",
      "tvdbId": "",
      "status": "AVAILABLE",
      "status4k": "UNKNOWN"
    },
    "request": {
      "request_id": "999",
      "requestedBy_email": "test@example.com",
      "requestedBy_username": "TestUser",
      "requestedBy_avatar": "https://plex.tv/users/test/avatar",
      "requestedBy_settings_discordId": "",
      "requestedBy_settings_telegramChatId": ""
    },
    "issue": {},
    "comment": {},
    "extra": []
  }'
```

---

## Troubleshooting

### Issue: "Missing required field" warning

**Symptoms:**

```
Node status: Missing: notification_type [ID: 150] (yellow dot)
```

**Causes:**

- Webhook template has dynamic keys (`"{{notification_type}}"` instead of `"notification_type"`)
- Jellyseerr variable not populating correctly
- JSON syntax error in template

**Solution:**

1. Verify you're using the [Correct Webhook Template](#correct-webhook-template)
2. Check Jellyseerr logs for variable substitution errors
3. Validate JSON syntax using a JSON validator

---

### Issue: Request ID not showing in status

**Symptoms:**

```
Node status: ✓ Normalized (green dot)  # Missing [ID: 150]
```

**Causes:**

- `request.request_id` field is missing or null
- Webhook template uses wrong field name (`"id"` instead of `"request_id"`)

**Solution:**

1. Verify `"request_id": "{{request_id}}"` exists in template
2. Check that `{{request_id}}` is a valid Jellyseerr variable
3. Test with a real request (not test notification)

---

### Issue: Issue ID not showing in status

**Symptoms:**

```
Node status: ✓ Normalized (green dot)  # Missing [ID: 42]
```

**Causes:**

- Using `"issue_id"` instead of `"id"` in template
- Issue webhook not configured
- Testing with non-issue event type

**Solution:**

1. Change template to use `"id": "{{issue_id}}"` (not `"issue_id"`)
2. Test with an actual issue report event
3. Verify issue notifications are enabled in Jellyseerr

---

### Issue: Dynamic key names appearing

**Symptoms:**

```json
{
  "movie": { ... },  // Should be "media"
  "": { ... }        // Should be "request"
}
```

**Causes:**

- Template uses `"{{media}}"` instead of `"media"`
- Template uses `"{{request}}"` instead of `"request"`

**Solution:**

1. Replace **all** dynamic key names with static strings
2. Only use `{{variables}}` for **values**, not keys
3. Use the [Correct Webhook Template](#correct-webhook-template)

---

### Issue: Empty objects in payload

**Symptoms:**

```json
{
  "request": {},
  "issue": {},
  "comment": {}
}
```

**Explanation:** This is **normal behavior**! Jellyseerr only populates the relevant object:

- `request` is populated for request events
- `issue` is populated for issue events
- `comment` is populated for comment events

**No action needed** - the webhook handler correctly handles empty objects.

---

### Issue: Webhook not firing at all

**Symptoms:**

- No messages appearing in Node-RED debug panel
- Node status never updates

**Causes:**

1. **Network connectivity** - Jellyseerr can't reach Node-RED
2. **Firewall blocking** - Port 1880 not accessible
3. **URL incorrect** - Wrong endpoint configured
4. **Events not enabled** - Event types not selected in Jellyseerr
5. **Webhook disabled** - Webhook agent not enabled

**Solution:**

1. Test connectivity: `curl https://your-node-red-domain.com:1880/endpoint/requests`
2. Check firewall rules and port forwarding
3. Verify URL matches Node-RED HTTP In node configuration
4. Enable desired event types in Jellyseerr webhook settings
5. Ensure webhook notification agent is enabled and saved

---

## 📚 Related Documentation

- [jellyseerr_webhook_handler.js](../jellyseerr_webhook_handler.js) - Webhook normalization logic
- [jellyseerr_textbee_notify.js](../jellyseerr_textbee_notify.js) - SMS notification handler
- [jellyseerr_tts_notify.js](../jellyseerr_tts_notify.js) - TTS announcement handler
- [auth_gate.js](../auth_gate.js) - Webhook authentication validator
- [TEXTBEE_CONFIG.json](../config/TEXTBEE_CONFIG.json) - User notification preferences

---

## 🆘 Support

If you encounter issues not covered in this guide:

1. **Check Node-RED logs** - Look for error messages or warnings
2. **Enable debug logging** - Set `LOGGING_ENABLED = true` in webhook handler
3. **Inspect payloads** - Use Node-RED debug nodes to examine raw webhook data
4. **Review Jellyseerr logs** - Check for webhook send failures or errors
5. **Test with cURL** - Isolate whether issue is Jellyseerr or Node-RED

---

**Last Updated:** 2025-10-17  
**Maintainer:** Node-RED Home Automation Team  
**Version:** 1.0.0
