# Jellyseerr TextBee Notify - Changelog v1.7.x

## v1.7.4 (2025-10-18)

### Bug Fix

- **ISSUE_COMMENT username logic**: Fixed duplicate name display when same person comments on their own issue
  - Problem: Template showed "Quentin King, Quentin King just added..." when user commented on own issue
  - Root cause: Both `{name}` (recipient) and `{username}` (actor) resolved to issue reporter, not commenter
  - Solution: Added event-specific username extraction that prioritizes `commentedBy_username` for ISSUE_COMMENT events
  - Impact: Now correctly distinguishes between comment author and notification recipient

### Technical Implementation

```javascript
// Before: Always used issue reporter's username
"{username}": payload.request?.requestedBy_username || payload.issue?.reportedBy_username || "Unknown"

// After: Event-aware username selection
if (eventType === "ISSUE_COMMENT" && payload.comment?.commentedBy_username) {
    actorUsername = payload.comment.commentedBy_username;
} else if (payload.request?.requestedBy_username) {
    actorUsername = payload.request.requestedBy_username;
} else if (payload.issue?.reportedBy_username) {
    actorUsername = payload.issue.reportedBy_username;
}
```

---

## v1.7.3 (2025-10-18)

### Bug Fix

- **Deduplication key sanitization**: Enhanced to remove spaces in addition to colons
  - Problem: Usernames with spaces (e.g., "Quentin King") caused Node-RED context errors
  - Error: `Invalid property expression: unexpected ' ' at position 23`
  - Root cause: Node-RED context keys cannot contain spaces or special characters
  - Solution: Changed regex from `/:/g` to `/[:\s]/g` to strip both colons and whitespace
  - Impact: Fixes crashes when processing events from users with spaces in their Jellyseerr usernames

### Technical Implementation

```javascript
// Before: Only removed colons
const requestId = String(requestIdRaw).replace(/:/g, "_");
const requesterKey = String(requesterKeyRaw).replace(/:/g, "_");

// After: Removes colons AND spaces
const requestId = String(requestIdRaw).replace(/[:\s]/g, "_");
const requesterKey = String(requesterKeyRaw).replace(/[:\s]/g, "_");
```

**Example transformations:**

- `"Quentin King"` → `"quentin_king"`
- `"issue:5"` → `"issue_5"`
- `"Title: Movie (2024)"` → `"Title__Movie_(2024)"`

---

## v1.7.2 (2025-10-17)

### Enhancement

- **Timezone-aware status timestamps**: Added `date-fns-tz` integration for America/Chicago timezone
  - Node status now shows: `"✓ Sent: Betty King 10/17/2025 22:47"` format
  - Fallback to local server time if `date-fns-tz` unavailable
  - Simplified status text from "Queued" to "Sent" for user clarity (TextBee always returns QUEUED status)

### Technical Implementation

- Added `formatInTimeZone()` from `date-fns-tz` module
- Format: `'M/d/yyyy HH:mm'` (e.g., "10/17/2025 22:47")
- Graceful degradation if module missing

---

## v1.7.1 (2025-10-17)

### Fixes (GitHub Copilot PR Review)

1. **Enhanced `maskPhone()` function**: Properly handles international E.164 formats
   - Now supports varying country code lengths (1-3 digits)
   - Adapts masked region based on subscriber number length
   - Example: `+1402***6154`, `+44123***7890`

2. **Reduced debug log noise**: Phone normalization only logs when value changes
   - Before: Logged every time even if already normalized
   - After: Only logs when transformation occurs

3. **Sanitized deduplication keys**: Prevents colon conflicts in context key format
   - Replaces `:` with `_` in `requestId` and `requesterKey`
   - Example: `dd:ISSUE_CREATED:5:user@email.com` → `dd:ISSUE_CREATED:5:user_email.com`

---

## v1.7.0 (2025-10-16)

### Production Hardening (ChatGPT Feedback)

#### Security & Privacy

- **Masked phone numbers in info logs**: PII-safe logging with last 4 digits only
  - Full numbers only appear in debug/trace logs
  - Example: `+1402***6154` instead of `+14025606154`

#### Reliability

- **Normalized event types**: Case-insensitive matching with `.toUpperCase()`
  - Handles `media_approved`, `MEDIA_APPROVED`, `Media_Approved` equivalently

- **User-scoped deduplication**: Prevents different users from squelching each other
  - Dedupe key format: `dd:{EVENT}:{REQUEST_ID}:{USER_KEY}`
  - Example: `dd:MEDIA_AVAILABLE:123:user@example.com`

- **Prefixed dedupe keys**: All keys start with `"dd:"` for faster cleanup
  - Enables targeted context cleanup without affecting other flow data
  - Periodic cleanup removes keys older than 2x squelch window

#### User Experience

- **Variant rotation**: Avoids back-to-back identical messages
  - Tracks last variant index per event type
  - If random selection matches last, increments to next variant

- **Improved status text**: Shows squelch window duration when suppressing duplicates
  - Example: `"Duplicate (60s window)"` instead of generic "Duplicate"

### Configuration Changes

- Dedupe keys now prefixed: `"dd:MEDIA_AVAILABLE:..."` instead of `"MEDIA_AVAILABLE:..."`
- Last variant tracking: New context keys like `"last_variant:MEDIA_AVAILABLE"`

---

## v1.6.1 (2025-10-15)

### Bug Fix

- **Node status display correction**: "Queued" now shows green checkmark (✓)
  - Clarified that QUEUED/PENDING/ACCEPTED statuses indicate success
  - TextBee's queue system means SMS is accepted and will be sent shortly
  - All success-path statuses now show green instead of blue

---

## v1.6.0 (2025-10-14)

### Major Feature: Multi-Variant Messages

#### New Capabilities

- **9-10 message variants per event**: Prevents notification fatigue
- **Randomized signature selection**: 5 different bot signatures
- **Conversational tone variations**: Natural, non-robotic messaging
- **Array template support**: Backward compatible with string templates

#### Template Structure

```json
{
  "templates": {
    "request_approved": [
      "✅ Great news, {name}! Your request for \"{title}\" got the green light...",
      "🎉 Lights, camera, download! \"{title}\" got approved...",
      "⚡️ The download gods smile upon you, {name}! \"{title}\" is on the move."
    ]
  },
  "signatures": [
    "— 🎬 Jellyseerr Bot",
    "— 🍿 Jellyseerr HQ",
    "— 📺 Your Friendly Media Bot"
  ]
}
```

#### Variant Selection Logic

- Random selection from template pool
- Avoids immediate repeats (tracks last variant index)
- Falls back to single string templates (legacy support)
- Random signature appended to each message

---

## Older Versions

For changelog entries prior to v1.7.0, see:

- [CHANGELOG_v1.6.0.md](./CHANGELOG_v1.6.0.md) - Multi-variant messages
- [CHANGELOG_v1.4.0.md](./CHANGELOG_v1.4.0.md) - Core functionality improvements
- Main script header for v1.5.0 details
