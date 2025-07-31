# Pushover Message API

The Pushover API provides a simple, versioned REST interface for sending push notifications to devices. No complex authentication mechanisms like OAuth are required - just standard HTTP libraries available in virtually any programming language.

## Table of Contents

- [Quick Start](#quick-start)
- [Application Registration](#application-registration)
- [Users, Groups, and Devices](#users-groups-and-devices)
- [Sending Messages](#sending-messages)
- [API Parameters](#api-parameters)
- [Message Styling](#message-styling)
- [Message Priority](#message-priority)
- [Attachments](#attachments)
- [Response Format](#response-format)
- [Rate Limits & Usage](#rate-limits--usage)
- [Best Practices](#best-practices)
- [User Validation](#user-validation)

## Quick Start

1. **Register your application** to get an API token (`APP_TOKEN`)
2. **Send a POST request** to `https://api.pushover.net/1/messages.json`

### Required Parameters

| Parameter | Description |
|-----------|-------------|
| `token` | Your application's API token |
| `user` | Target user/group key (`USER_KEY`) |
| `message` | The notification message text |

### Example Request

```bash
curl -X POST https://api.pushover.net/1/messages.json \
  -d "token=YOUR_APP_TOKEN" \
  -d "user=YOUR_USER_KEY" \
  -d "message=Hello World!"
```

> **Need help?** Contact Pushover support for API assistance or to report documentation errors.

## Application Registration

Before sending notifications, you must register your application (free) to obtain an API token. During registration, you can:

- Set your application name (used as default message title)
- Upload an icon (displayed with notifications)
- Get your unique API token

### API Token Format

```text
Example: azGDORePK8gMaC0QOYAMyEEuzJnyUi
```

**Token specifications:**

- Length: 30 characters
- Case-sensitive
- Character set: `[A-Za-z0-9]`
- Required for all API calls

> **⚠️ Important:** The example token above is for demonstration only and will not work with the API.

### Distribution Guidelines

For client-side libraries or open source projects that will be redistributed:

- Require end-users to register their own applications
- Do not include your API token in distributed software
- See the Pushover Knowledge Base for more information

## Users, Groups, and Devices

After obtaining your API token, you need user keys and optional device names for notification recipients.

### User Keys

Each Pushover user has a unique identifier for receiving notifications:

```text
Example User ID: uQiRzpo4DXghDmr9QzzfQu27cmVRsG
```

**User key specifications:**

- Length: 30 characters
- Case-sensitive
- Character set: `[A-Za-z0-9]`
- Keep private and secure

### Group Keys

Groups function identically to user keys from your application's perspective:

```text
Example Group ID: gznej3rKEVAvPUxu9vvNnqpmZpokzF
```

When sending to a group, all active group members receive the notification.

### Device Names

Target specific devices within a user account:

```text
Example Device: droid2
```

**Device specifications:**

- Optional parameter
- Maximum length: 25 characters
- Character set: `[A-Za-z0-9_-]`
- Multiple devices: comma-separated (e.g., `iphone,nexus5`)

### Delivery Behavior

| Scenario | Device Parameter Behavior |
|----------|---------------------------|
| Single user | Targets specified device(s) or all devices if omitted |
| Group (non-Teams) | Ignored - uses group device settings |
| Group (Teams) | Honored - targets matching devices in group |
| Multiple users | Ignored - delivers to all user devices |

### Multiple Recipients

Send to multiple users in one request:

- Comma-separated user keys (no spaces)
- Maximum: 50 users per request
- Example: `user=key1,key2,key3`

### Security Notes

- Keep user keys private
- Allow users to update their keys in your application
- Consider implementing optional user validation

## Sending Messages

### API Endpoint

```http
POST https://api.pushover.net/1/messages.json
```

**Format options:**

- JSON response: `.json` suffix (recommended)
- XML response: `.xml` suffix

### Request Requirements

- **Method:** POST (required)
- **Protocol:** HTTPS (required)
- **Content-Type:** `application/x-www-form-urlencoded` or `application/json`
- **TLS/SSL:** Enable verification for security

### Basic Example

**Request parameters:**

```text
token=azGDORePK8gMaC0QOYAMyEEuzJnyUi
user=uQiRzpo4DXghDmr9QzzfQu27cmVRsG
device=droid4
title=Backup finished - SQL1
message=Backup of database "example" finished in 16 minutes.
```

**HTTP request:**

```http
POST /1/messages.json HTTP/1.1
Host: api.pushover.net
Content-Type: application/x-www-form-urlencoded
Content-Length: 180

token=azGDORePK8gMaC0QOYAMyEEuzJnyUi&user=uQiRzpo4DXghDmr9QzzfQu27cmVRsG&device=droid4&title=Backup+finished+-+SQL1&message=Backup+of+database+%22example%22+finished+in+16+minutes.
```

### URL Handling

URLs in message text are automatically converted to clickable links. For additional URL functionality, see the Supplementary URLs section below.

## API Parameters

### API Message Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | string | Your application's API token |
| `user` | string | User/group key of the recipient |
| `message` | string | The notification message (max 1024 UTF-8 chars) |

### Optional Parameters

| Parameter | Type | Description | Notes |
|-----------|------|-------------|-------|
| `title` | string | Message title (max 250 chars) | Defaults to app name |
| `device` | string | Target device name(s) | Comma-separated for multiple |
| `priority` | integer | Message priority: -2, -1, 0, 1, 2 | Default: 0 (normal) |
| `sound` | string | Notification sound name | See [Notification Sounds](#notification-sounds) |
| `timestamp` | integer | Unix timestamp for message time | Defaults to current time |
| `url` | string | Supplementary URL (max 512 chars) | Clickable link in notification |
| `url_title` | string | Title for URL (max 100 chars) | Defaults to URL itself |
| `html` | integer | Enable HTML formatting (1 or 0) | Cannot use with `monospace` |
| `monospace` | integer | Enable monospace font (1 or 0) | Cannot use with `html` |
| `ttl` | integer | Time to live in seconds | Auto-delete after specified time |

### Attachment Parameters

| Parameter | Type | Description | Notes |
|-----------|------|-------------|-------|
| `attachment` | file | Binary image data | Max 5MB, multipart/form-data |
| `attachment_base64` | string | Base64-encoded image | Alternative to binary upload |
| `attachment_type` | string | MIME type (e.g., image/jpeg) | Required with `attachment_base64` |

### Emergency Priority Parameters

Required when `priority=2`:

| Parameter | Type | Description | Notes |
|-----------|------|-------------|-------|
| `retry` | integer | Retry interval in seconds | Minimum: 30 seconds |
| `expire` | integer | Expiration time in seconds | Maximum: 10800 (3 hours) |
| `callback` | string | URL for acknowledgment callback | Must be publicly accessible |
| `tags` | string | Comma-separated tags | For bulk receipt management |

## Message Styling

Pushover supports two text formatting options for enhanced message display.

### HTML Formatting

Enable HTML formatting by setting `html=1`:

**Supported HTML tags:**

```html
<b>bold text</b>
<i>italic text</i>
<u>underlined text</u>
<font color="#0000ff">colored text</font>
<a href="https://example.com/">linked text</a>
```

### Monospace Formatting

Enable monospace font by setting `monospace=1`:

- Useful for code snippets, logs, or structured data
- Cannot be used simultaneously with HTML formatting

### Formatting Limitations

- HTML/monospace formatting is stripped from push notifications
- Full formatting displays only when the app is opened
- Choose either HTML or monospace, not both

## Custom Message Timestamp

By default, messages use the server receive time. Override with the `timestamp` parameter:

```text
timestamp=1331249662
```

This displays as: March 8, 2012 17:34:22 (in user's local timezone)

**Use cases:**

- Queued messages from remote servers
- Out-of-order message delivery
- Historical event logging

## Message Priority

Control notification behavior and urgency with the `priority` parameter. Default priority is 0 (normal).

### Priority Levels

| Priority | Value | Behavior | Use Cases |
|----------|-------|----------|-----------|
| **Lowest** | -2 | No notification, badge only | Background updates, statistics |
| **Low** | -1 | Notification without sound/vibration | Non-urgent information |
| **Normal** | 0 | Standard notification (default) | Regular notifications |
| **High** | 1 | Bypasses quiet hours | Important alerts |
| **Emergency** | 2 | Repeated until acknowledged | Critical system alerts |

### Detailed Priority Behaviors

#### Lowest Priority (-2)

- No sound, vibration, or popup
- Only increases app badge number (iOS)
- Useful for background status updates

#### Low Priority (-1)

- Shows notification without sound/vibration
- Automatically applied during user's quiet hours
- Good for informational messages

#### Normal Priority (0)

- Standard notification behavior
- Respects user device settings for sound/vibration
- Most common priority level

#### High Priority (1)

- **Bypasses quiet hours**
- Always plays sound and vibrates (if configured)
- Highlighted in red in Pushover clients
- Use sparingly and appropriately

#### Emergency Priority (2)

- Repeated notifications until acknowledged
- First acknowledgment cancels retries for entire group
- Requires additional parameters: `retry` and `expire`
- Returns receipt for tracking acknowledgment status

### Emergency Priority Configuration

When using `priority=2`, these parameters are required:

```http
priority=2
retry=60          # Retry every 60 seconds
expire=1800       # Stop after 30 minutes (1800 seconds)
callback=https://myapp.com/pushover/callback  # Optional webhook
```

**Retry parameter:**

- Minimum: 30 seconds
- How often to repeat the notification

**Expire parameter:**

- Maximum: 10800 seconds (3 hours)
- When to stop retrying
- Maximum 50 total retries regardless of expire time

**Examples:**

- `retry=60, expire=1800`: Every 60s for 30 minutes
- `retry=30, expire=10800`: Every 30s for 25 minutes (50 retry limit)

## Time to Live (TTL)

Control message lifespan on devices with the `ttl` parameter.

### Default Behavior

Messages persist on devices until:

- Manually deleted by user
- Automatically deleted when device message limit exceeded

### TTL Configuration

```http
ttl=3600  # Delete after 1 hour (3600 seconds)
```

**TTL specifications:**

- Value in seconds (positive integer)
- Countdown starts when API receives message
- Ignored for emergency priority messages (`priority=2`)
- Requires app version 4.0+ (iOS/Android)

**Limitations:**

- iOS/iPadOS may not remove expired notifications immediately
- Removal typically occurs when next notification arrives

## Supplementary URLs

Add clickable links to notifications beyond those in message text.

### Basic URL Example

```http
url=https://example.com/status
url_title=View Status Page
```

### Advanced Example: Twitter Integration

```http
token=azGDORePK8gMaC0QOYAMyEEuzJnyUi
user=uQiRzpo4DXghDmr9QzzfQu27cmVRsG
message=This is a Twitter pic http://twitpic.com/blah
title=Direct message from @someuser
url=twitter://direct_message?screen_name=someuser
url_title=Reply to @someuser
```

**Result:** Notification shows message with clickable "Reply to @someuser" link

### URL Specifications

| Parameter | Max Length | Description |
|-----------|------------|-------------|
| `url` | 512 characters | The target URL |
| `url_title` | 100 characters | Display text (defaults to URL) |

### URL Scheme Considerations

**Universal schemes:**

- `https://` - Web links
- `tel:` - Phone calls
- `sms:` - Text messages

**App-specific schemes:**

- `twitter://` - Twitter app actions
- `spotify://` - Spotify playback
- Platform and app installation dependent

> **⚠️ Warning:** Avoid app-specific URL schemes in public applications, as they may not work across all user devices.

## Notification Sounds

Customize notification sounds using the `sound` parameter to override user defaults.

### Built-in Sounds

| Sound Name | Description | Duration |
|------------|-------------|----------|
| `pushover` | Pushover (default) | Short |
| `bike` | Bike | Short |
| `bugle` | Bugle | Short |
| `cashregister` | Cash Register | Short |
| `classical` | Classical | Short |
| `cosmic` | Cosmic | Short |
| `falling` | Falling | Short |
| `gamelan` | Gamelan | Short |
| `incoming` | Incoming | Short |
| `intermission` | Intermission | Short |
| `magic` | Magic | Short |
| `mechanical` | Mechanical | Short |
| `pianobar` | Piano Bar | Short |
| `siren` | Siren | Short |
| `spacealarm` | Space Alarm | Short |
| `tugboat` | Tug Boat | Short |
| `alien` | Alien Alarm | Long |
| `climb` | Climb | Long |
| `persistent` | Persistent | Long |
| `echo` | Pushover Echo | Long |
| `updown` | Up Down | Long |
| `vibrate` | Vibrate Only | Silent |
| `none` | None (silent) | Silent |

### Custom Sounds

Since April 2021, users can upload custom sounds:

- Upload sounds through Pushover website
- Application owners can specify custom sounds for all recipients
- Custom sounds play for all users receiving the message

### Sound API

Retrieve available sounds (including custom ones):

```http
GET https://api.pushover.net/1/sounds.json?token=YOUR_APP_TOKEN
```

**Response format:**

```json
{
  "sounds": {
    "pushover": "Pushover (default)",
    "bike": "Bike",
    "custom_sound": "My Custom Alert"
  }
}
```

### Implementation Notes

- **Default behavior:** User's chosen sound plays when `sound` parameter omitted
- **Blank option:** Always provide users option to use their default sound
- **Override responsibly:** Only override sounds when contextually appropriate

## Attachments

Send image attachments with notifications (requires app version 3.0+).

### Attachment Specifications

- **File limit:** 5,242,880 bytes (5.0 MB)
- **Quantity:** One attachment per message
- **Types:** Image files (JPEG, PNG, GIF, etc.)
- **Delivery:** Direct binary upload (no URLs)
- **Privacy:** Files deleted from servers after device download

### Upload Methods

#### Method 1: multipart/form-data (Recommended)

Send binary data directly with proper Content-Type headers:

```http
POST /1/messages.json HTTP/1.1
Host: api.pushover.net
Content-Type: multipart/form-data; boundary=--boundary123

--boundary123
Content-Disposition: form-data; name="token"

YOUR_APP_TOKEN
--boundary123
Content-Disposition: form-data; name="user"

YOUR_USER_KEY
--boundary123
Content-Disposition: form-data; name="message"

Check out this image!
--boundary123
Content-Disposition: form-data; name="attachment"; filename="screenshot.jpg"
Content-Type: image/jpeg

[BINARY IMAGE DATA]
--boundary123--
```

#### Method 2: Base64 Encoding

For HTTP clients without multipart support:

```http
POST /1/messages.json HTTP/1.1
Host: api.pushover.net
Content-Type: application/x-www-form-urlencoded

token=YOUR_APP_TOKEN&user=YOUR_USER_KEY&message=Check%20out%20this%20image!&attachment_base64=iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==&attachment_type=image/png
```

**Base64 parameters:**

- `attachment_base64`: Base64-encoded image data
- `attachment_type`: MIME type (e.g., `image/jpeg`, `image/png`)

**Note:** Base64 encoding increases data size by ~35%

### Attachment Behavior

- **Download failure:** Notification displays without image, retry available in app
- **Unsupported devices:** Attachments discarded for app versions < 3.0
- **Storage:** Images stored locally on device, not on Pushover servers
- **Display:** Full image visible only when app is opened

## Response Format

The Pushover API returns structured responses indicating success or failure.

### Success Response

**HTTP Status:** 200 OK

```json
{
  "status": 1,
  "request": "647d2300-702c-4b38-8b2f-d56326ae460b"
}
```

### Emergency Priority Response

For `priority=2` messages, includes receipt for tracking:

```json
{
  "status": 1,
  "request": "647d2300-702c-4b38-8b2f-d56326ae460b",
  "receipt": "emergency_receipt_id_12345"
}
```

### Error Response

**HTTP Status:** 4xx (Client Error)

```json
{
  "user": "invalid",
  "errors": ["user identifier is invalid"],
  "status": 0,
  "request": "5042853c-402d-4a18-abcb-168734a801de"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | integer | 1 = success, 0 = error |
| `request` | string | Unique request identifier for support |
| `receipt` | string | Emergency priority tracking ID |
| `errors` | array | List of validation errors |

### Error Handling

**Common error scenarios:**

- Invalid token or user key
- Missing required parameters
- Exceeded message limits
- Invalid parameter values

**Request ID:** Always include the `request` field when contacting support

## Rate Limits & Usage

Understanding Pushover's usage limits and monitoring your application's consumption.

### Message Limits

| Application Type | Monthly Limit | Notes |
|------------------|---------------|-------|
| **Standard App** | 10,000 messages | Free tier |
| **Team App** | 25,000 messages | One team app per account |
| **Paid Plans** | Higher limits available | See Knowledge Base |

### Limit Calculation

- **One message** = One successful API call to one user
- **Group messages** = One message per group member
- **Multi-user requests** = One message per user in request
- **Device count** = Irrelevant to message counting

### Usage Monitoring

Monitor your usage through HTTP headers returned with each API call:

```http
X-Limit-App-Limit: 10000
X-Limit-App-Remaining: 7496
X-Limit-App-Reset: 1393653600
```

**Header descriptions:**

- `X-Limit-App-Limit`: Total monthly allowance
- `X-Limit-App-Remaining`: Messages remaining this month
- `X-Limit-App-Reset`: Unix timestamp of next reset

### Limits API Endpoint

Get current usage without sending a message:

```http
GET https://api.pushover.net/1/apps/limits.json?token=YOUR_APP_TOKEN
```

**Response:**

```json
{
  "limit": 10000,
  "remaining": 7496,
  "reset": 1393653600
}
```

### Limit Exceeded

When limits are reached:

- **HTTP Status:** 429 (Too Many Requests)
- **Reset time:** 00:00:00 Central Time, 1st of each month
- **Statistics:** Available on application dashboard

### Message Lifecycle

1. **API Receipt:** Message queued for delivery
2. **Carrier Delivery:** Sent to Apple/Google servers
3. **Device Sync:** User opens app, HTTPS sync occurs
4. **Verification:** Message marked as delivered
5. **Cleanup:** Message deleted from Pushover servers

**Retention policy:**

- Undelivered messages: Deleted after 21 days
- Delivered messages: Deleted immediately after device confirmation

## Best Practices

Guidelines for reliable and responsible API usage.

### Response Handling

**✅ Success (HTTP 200, status=1):**

- Message queued successfully
- Continue normal operation

**❌ Client Error (HTTP 4xx, status≠1):**

- Invalid input parameters
- Parse `errors` array for details
- **Do not retry** without fixing the issue
- Common causes: invalid tokens, quota exceeded, missing parameters

**⚠️ Server Error (HTTP 5xx):**

- Temporary Pushover server issues
- **Wait minimum 5 seconds** before retry
- Avoid flooding servers with rapid retries

### Rate Limiting Guidelines

**Connection limits:**

- Maximum 2 concurrent TCP connections
- Use HTTP keep-alive for multiple requests
- Send requests sequentially over same connection

**Retry behavior:**

- Implement exponential backoff for server errors
- Stop retrying 4xx errors immediately
- Monitor for automatic IP blocking (excessive 4xx responses)

### Security Considerations

**Token management:**

- Keep API tokens secure and private
- Use environment variables, not hardcoded values
- Implement token rotation when possible
- For open source projects: require user registration

**TLS/SSL:**

- Always enable certificate verification
- Use HTTPS exclusively
- Never send credentials over HTTP

### Message Design

**Content guidelines:**

- Keep messages concise and actionable
- Use appropriate priority levels responsibly
- Consider user timezone for timestamp parameters
- Test with different device types and orientations

**Accessibility:**

- Provide meaningful titles
- Avoid relying solely on colors or formatting
- Consider users with hearing impairments (sound selection)

### Error Prevention

**Common mistakes to avoid:**

- Hardcoding user keys in applications
- Ignoring HTTP status codes
- Retrying 4xx errors indefinitely
- Sending oversized attachments without validation
- Using emergency priority inappropriately

**Testing recommendations:**

- Test with valid and invalid parameters
- Verify attachment size limits
- Test network timeout scenarios
- Validate user input before API calls

## User Validation

Optionally validate user and group identifiers to ensure proper configuration.

### Validation Endpoint

```http
POST https://api.pushover.net/1/users/validate.json
```

### Validation Parameters

#### Required

| Parameter | Description |
|-----------|-------------|
| `token` | Your application's API token |
| `user` | User or group identifier to validate |

#### Optional

| Parameter | Description |
|-----------|-------------|
| `device` | Specific device name to validate |

### Validation Success Response

**User with active devices:**

```json
{
  "status": 1,
  "devices": ["iphone", "android-tablet"],
  "licenses": ["iOS", "Android"],
  "request": "validation-request-id-12345"
}
```

### Validation Error Response

**Invalid user or no active devices:**

```json
{
  "status": 0,
  "errors": ["user identifier is invalid"],
  "request": "validation-request-id-67890"
}
```

### Validation Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | integer | 1 = valid, 0 = invalid |
| `devices` | array | List of user's active device names |
| `licenses` | array | Platforms the account is licensed for |
| `errors` | array | Validation error messages |

### Validation Scenarios

**Device-specific validation:**

- Include `device` parameter to validate specific device
- Returns success only if device exists and is active
- Useful for device-targeted applications

**General validation:**

- Omit `device` parameter for general user validation
- Returns success if user has at least one active device
- Recommended for most applications

### Implementation Guidelines

**When to validate:**

- During user registration/setup
- When users report delivery issues
- Periodically for critical applications
- Before bulk message campaigns

**Error handling:**

- Provide clear feedback for invalid identifiers
- Suggest double-checking copy/paste operations
- Guide users to find their keys in Pushover dashboard

---

## Quick Reference

### Character Limits

| Element | Limit |
|---------|-------|
| Message | 1,024 UTF-8 characters |
| Title | 250 characters |
| URL | 512 characters |
| URL Title | 100 characters |

### API Endpoints

| Purpose | Method | URL |
|---------|--------|-----|
| Send Message | POST | `https://api.pushover.net/1/messages.json` |
| Validate User | POST | `https://api.pushover.net/1/users/validate.json` |
| Get Sounds | GET | `https://api.pushover.net/1/sounds.json?token=TOKEN` |
| Check Limits | GET | `https://api.pushover.net/1/apps/limits.json?token=TOKEN` |

### Priority Quick Reference

| Value | Name | Behavior |
|-------|------|----------|
| -2 | Lowest | Badge only, no notification |
| -1 | Low | Silent notification |
| 0 | Normal | Standard notification (default) |
| 1 | High | Bypasses quiet hours |
| 2 | Emergency | Repeated until acknowledged |
