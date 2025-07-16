# date-fns & date-fns-tz Usage in Node-RED Automations

This document explains how to use the `date-fns` and `date-fns-tz` libraries for date and time formatting in Node-RED JavaScript function nodes, with a focus on Home Assistant and notification automations.

---

## What are `date-fns` and `date-fns-tz`?

- **date-fns**: A modern JavaScript date utility library for parsing, formatting, and manipulating dates.
- **date-fns-tz**: An extension for `date-fns` that adds time zone support, including formatting dates in specific time zones and handling daylight saving time.

---

## Why Use These Libraries in Node-RED?

- Format timestamps for notifications (e.g., "June 27th, 2025 3:00 PM CST").
- Ensure correct time zone and daylight saving handling for users in different regions.
- Generate human-friendly date strings for TTS and push notifications.

---

## Standard Operating Procedure (SOP)

### 1. Module Setup in Node-RED Function Nodes

**Always add these modules in the function node's Setup tab:**

- `date-fns` (version 3.6.0 or later)
- `date-fns-tz` (version 2.0.0 or later)

**DO NOT use `require()`** - modules are available as global variables `dateFns` and `dateFnsTz`.

### 2. Standard Implementation Pattern

```javascript
// --- Standard Date Formatting Setup ---
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago'; // Always use consistent timezone

// --- Error Handling for Missing Libraries ---
if (!dateFnsTz?.formatInTimeZone) {
    node.error('date-fns-tz not available in global context');
    return null;
}

// --- Generate Formatted Timestamps ---
const now = new Date();
const formattedTimePush = formatInTimeZone(now, TIME_ZONE, "MMMM do, yyyy h:mm a zzz");
const formattedTimeTTS = formatInTimeZone(now, TIME_ZONE, "MMMM do, yyyy 'at' h:mm a zzz");
```

### 3. Required Constants

```javascript
// Standard timezone constant
const TIME_ZONE = 'America/Chicago';

// Standard format strings
const PUSH_FORMAT = "MMMM do, yyyy h:mm a zzz";      // "June 27th, 2025 3:00 PM CDT"
const TTS_FORMAT = "MMMM do, yyyy 'at' h:mm a zzz";  // "June 27th, 2025 at 3:00 PM CDT"
const ISO_FORMAT = "yyyy-MM-dd HH:mm:ss";            // "2025-06-27 15:00:00"
```

---

## How to Use in Node-RED Function Nodes

> **Note:** When you add `date-fns` and `date-fns-tz` as modules in a Node-RED function node's Setup tab, you do **not** need to use `require`. The modules are automatically available as global variables—use `dateFns` and `dateFnsTz` directly in your code.

---

## Standard Implementation Examples

### Example 1: Basic Notification Timestamp

```javascript
// Standard implementation pattern used across all notification functions
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

function getFormattedTimes(date = new Date()) {
    if (!dateFnsTz?.formatInTimeZone) {
        node.warn('date-fns-tz not available. Using fallback.');
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
    
    return {
        formattedTimePush: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy h:mm a zzz"),
        formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy 'at' h:mm a zzz")
    };
}

// Usage
const { formattedTimePush, formattedTimeTTS } = getFormattedTimes();
```

### Example 2: Time-Based Conditional Logic

```javascript
// Time restriction example from weather_flow/time_condition.js
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

function getCurrentHour() {
    if (!dateFnsTz?.formatInTimeZone) {
        node.warn('Using local server time; timezone may be incorrect.');
        return new Date().getHours();
    }
    
    const now = new Date();
    return Number(formatInTimeZone(now, TIME_ZONE, 'H'));
}

// Usage for time restrictions
const currentHour = getCurrentHour();
const isWithinAllowedHours = currentHour >= 7 && currentHour < 22;
```

### Example 3: Duration Formatting with Timestamps

```javascript
// From garage_left_open_notify.js - combining duration and timestamp
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

function formatDurationAndTime(durationSeconds) {
    // Format duration
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    let durationText;
    
    if (minutes > 0 && seconds > 0) {
        durationText = `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
    } else if (minutes > 0) {
        durationText = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
        durationText = `${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    
    // Format timestamp
    const now = new Date();
    const formattedTimePush = formatInTimeZone(now, TIME_ZONE, "MMMM do, yyyy h:mm a zzz");
    const formattedTimeTTS = formatInTimeZone(now, TIME_ZONE, "MMMM do, yyyy 'at' h:mm a zzz");
    
    return { durationText, formattedTimePush, formattedTimeTTS };
}
```

---

## Message Construction Patterns

### Pattern 1: Push Notification Messages

```javascript
// Standard push notification message format
const messageHtml = `\u200B<b><span style="color: #1565c0">Event occurred</span></b> \u200B<span style="color: #e65100">${details}</span></b><br><span style="color: #888">${formattedTimePush}</span>`;
const titleHtml = '\u200B<b><span style="color: #1565c0">Event Title</span></b>';

// For iOS (plain text)
const message = `Event occurred: ${details}\n${formattedTimePush}`;
const title = 'Event Title';
```

### Pattern 2: TTS Message Construction

```javascript
// TTS messages should be natural and conversational
const messageTTS = `Event occurred with ${details} on ${formattedTimeTTS}`;

// For urgent/important messages
const urgentTTS = `Attention: ${details} detected on ${formattedTimeTTS}. Please take immediate action.`;
```

---

## Error Handling and Fallbacks

### Standard Error Handling Pattern

```javascript
function getFormattedTimes(date = new Date()) {
    // Always check if date-fns-tz is available
    if (!dateFnsTz?.formatInTimeZone) {
        node.warn('date-fns-tz not available in global context. Using fallback.');
        const fallback = date.toISOString();
        return { 
            formattedTimePush: fallback, 
            formattedTimeTTS: fallback 
        };
    }
    
    try {
        return {
            formattedTimePush: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy h:mm a zzz"),
            formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy 'at' h:mm a zzz")
        };
    } catch (error) {
        node.error(`Error formatting date: ${error.message}`);
        const fallback = date.toISOString();
        return { 
            formattedTimePush: fallback, 
            formattedTimeTTS: fallback 
        };
    }
}
```

---

## Complete Implementation Template

```javascript
/**
 * Standard Node-RED Function Template with date-fns-tz
 * Copy this template for consistent implementation across all functions
 */

// --- Standard Date Formatting Setup ---
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

// --- Standard Format Strings ---
const FORMATS = {
    push: "MMMM do, yyyy h:mm a zzz",
    tts: "MMMM do, yyyy 'at' h:mm a zzz",
    iso: "yyyy-MM-dd HH:mm:ss",
    hourOnly: "H"
};

// --- Error Handling Function ---
function getFormattedTimes(date = new Date()) {
    if (!dateFnsTz?.formatInTimeZone) {
        node.warn('[Function Name] date-fns-tz not available. Using fallback.');
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
    
    try {
        return {
            formattedTimePush: formatInTimeZone(date, TIME_ZONE, FORMATS.push),
            formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, FORMATS.tts)
        };
    } catch (error) {
        node.error(`[Function Name] Error formatting date: ${error.message}`);
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
}

// --- Main Function Logic ---
const now = new Date();
const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(now);

// Use formattedTimePush for push notifications
// Use formattedTimeTTS for TTS messages
```

---

## Example Usage in Node-RED Function Node

Reference: See `north_garage_flow/garage_left_open_notify.js` for a real-world example.

```javascript
// Access dateFnsTz directly (no require needed)
const { formatInTimeZone } = dateFnsTz;
const timeZone = 'America/Chicago';

const now = new Date();
const formatted = formatInTimeZone(now, timeZone, "MMMM do, yyyy h:mm a zzz");
// formatted: "June 27th, 2025 3:00 PM CDT"
```

- `formatInTimeZone(date, timeZone, formatString)`
  - `date`: JavaScript Date object
  - `timeZone`: IANA time zone string (e.g., 'America/Chicago')
  - `formatString`: date-fns format string (see below)

---

## Common Format Strings

- `MMMM do, yyyy h:mm a zzz` → June 27th, 2025 3:00 PM CDT
- `yyyy-MM-dd HH:mm:ss` → 2025-06-27 15:00:00
- `h:mm a` → 3:00 PM
- `H` → 15 (24-hour format, single digit for getCurrentHour())

See the [date-fns format documentation](https://date-fns.org/v3.6.0/docs/format) for more options.

---

## Real-World Examples from Codebase

### From `garage_left_open_notify.js`

```javascript
const { formatInTimeZone } = dateFnsTz;
const timeZone = 'America/Chicago';

const now = new Date();
const formattedTimePush = formatInTimeZone(now, timeZone, "MMMM do, yyyy h:mm a zzz");
const formattedTimeTTS = formatInTimeZone(now, timeZone, "MMMM do, yyyy 'at' h:mm a zzz");

// HTML message for Android
const messageHtml = `\u200B<b><span style="color: #1565c0">The garage door was left open for</span></b> \u200B<span style="color: #e65100">${durationText}</span></b> <b><span style="color: #1565c0">and has been closed automatically.</span></b><br><span style="color: #888">${formattedTimePush}</span>`;

// TTS message
const messageTTS = `The garage door was left open for ${durationText} and has been closed automatically on ${formattedTimeTTS}`;
```

### From `time_condition.js`

```javascript
const { formatInTimeZone } = dateFnsTz;
const config = {
    timezone: 'America/Chicago',
    startHour: 7,
    endHour: 22
};

let currentHour;
if (formatInTimeZone) {
    const now = new Date();
    currentHour = Number(formatInTimeZone(now, config.timezone, 'H'));
} else {
    currentHour = new Date().getHours();
    node.warn('Using local server time; timezone may be incorrect.');
}
```

### From `alarm_handler.js`

```javascript
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

function getFormattedTimes(date) {
    if (typeof formatInTimeZone !== 'function') {
        node.warn('[alarm_handler] date-fns-tz not available. Returning ISO string.');
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
    return {
        formattedTimePush: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy h:mm a zzz"),
        formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy 'at' h:mm a zzz")
    };
}
```

---

## Best Practices

### DO's ✅

- Always specify the time zone explicitly (`America/Chicago`)
- Use consistent format strings across all functions
- Include error handling and fallbacks for missing libraries
- Use `'at'` in TTS strings for natural speech flow
- Test with different times including DST transitions
- Include function name in error/warning messages for debugging

### DON'Ts ❌

- Don't use `require()` for date-fns modules in Node-RED
- Don't hardcode timezone abbreviations (CST/CDT) - let date-fns handle it
- Don't assume the library is always available - include fallbacks
- Don't mix local time with timezone-aware formatting
- Don't forget to handle edge cases (invalid dates, network issues)

### Standard Naming Conventions

- `formattedTimePush` - for push notifications
- `formattedTimeTTS` - for TTS messages  
- `TIME_ZONE` - constant for timezone
- `getFormattedTimes()` - standard function name

---

## Testing Your Implementation

```javascript
// Add this test block to verify your implementation
function testDateFormatting() {
    const testDate = new Date('2025-06-27T15:00:00-05:00'); // CDT time
    const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(testDate);
    
    node.debug(`Push format: ${formattedTimePush}`);
    node.debug(`TTS format: ${formattedTimeTTS}`);
    
    // Expected outputs:
    // Push: "June 27th, 2025 3:00 PM CDT"
    // TTS:  "June 27th, 2025 at 3:00 PM CDT"
}

// Uncomment to test
// testDateFormatting();
```

---

## References

- [date-fns documentation](https://date-fns.org/)
- [date-fns-tz documentation](https://github.com/date-fns/date-fns-tz)
- [IANA time zone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
- [Node-RED Function Node Documentation](https://nodered.org/docs/user-guide/writing-functions)

---

<!-- Last updated: July 15, 2025 -->
