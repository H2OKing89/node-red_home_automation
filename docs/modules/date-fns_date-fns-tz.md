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

## How to Use in Node-RED Function Nodes

> **Note:** When you add `date-fns` and `date-fns-tz` as modules in a Node-RED function node’s Setup tab, you do **not** need to use `require`. The modules are automatically available as global variables—use `dateFns` and `dateFnsTz` directly in your code.

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

See the [date-fns format documentation](https://date-fns.org/v3.6.0/docs/format) for more options.

---

## Example: Garage Notification Timestamp

```javascript
const formattedTimePush = formatInTimeZone(now, timeZone, "MMMM do, yyyy h:mm a zzz");
const formattedTimeTTS = formatInTimeZone(now, timeZone, "MMMM do, yyyy 'at' h:mm a zzz");
```

- For push: "June 27th, 2025 3:00 PM CDT"
- For TTS:  "June 27th, 2025 at 3:00 PM CDT"

---

## Best Practices

- Always specify the time zone explicitly for user-facing notifications.
- Use `'at'` in TTS strings for natural speech.
- Use the same time zone for all automations to avoid confusion.

---

## References

- [date-fns documentation](https://date-fns.org/)
- [date-fns-tz documentation](https://github.com/date-fns/date-fns-tz)
- [IANA time zone database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)

---

<!-- Last updated: June 29, 2025 -->
