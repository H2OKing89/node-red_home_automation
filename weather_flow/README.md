# Node-RED Weather Alert Flow

This directory contains Node-RED function nodes and scripts for processing, filtering, and announcing National Weather Service (NWS) weather alerts. The flows are designed to deliver concise, relevant, and actionable notifications to your home audio devices, mobile devices, and notification services.

## Features

- **Priority Alert Assignment:**
  - Assigns priorities to incoming NWS alerts based on event type.
  - Handles duplicate alerts using a TTL (Time-To-Live) mechanism.
  - Supports multiple alerts in a single payload.

- **Text-to-Speech (TTS) Announcements:**
  - Announces weather alerts on Sonos and Google Home devices.
  - Filters out irrelevant geographic information (e.g., Iowa counties) and focuses on Nebraska content.
  - Only the most important details are spoken (event, headline, timing, instructions).
  - Configurable alert sounds and device lists.

- **Mobile Device TTS:**
  - Sends weather alert TTS notifications to a specified mobile device using Home Assistant's mobile app integration.
  - Customizable TTS stream, priority, and target device.

- **Notification Integrations:**
  - Pushover: Sends rich, length-limited notifications with emoji, HTML formatting, and sound selection.
  - Gotify: Sends markdown-formatted notifications with event art, meta info, and city/county highlights.

- **Time-Based Notification Restriction:**
  - Restricts notifications to certain hours, with bypass for critical events (e.g., Tornado Warnings).

## Requirements

- Node-RED (latest recommended)
- Home Assistant (for media player and mobile integrations)
- (Optional) Pushover, Gotify, and Sonos/Google Home integrations
- (Optional) Moment.js for advanced time handling (see `time_condition.js`)

## Files

- `priority_alerts.js` — Assigns priorities, deduplicates, and validates incoming alert payloads.
- `process_alert_tts.js` — Main TTS announcement logic for Sonos/Google Home, with advanced filtering and error handling.
- `process_alert_tts_mobile.js` / `weather_tts_mobile.js` — Sends TTS weather alerts to a mobile device via Home Assistant.
- `pushover_alert.js` — Formats and sends weather alerts to Pushover with HTML, emoji, and length validation.
- `gotify_alert.js` — Formats and sends weather alerts to Gotify with markdown, art, and meta info.
- `time_condition.js` — Restricts notifications to a time window, with bypass for critical events.

## Usage

1. **Import the function nodes into your Node-RED flow.**
2. **Configure device/entity IDs** in the configuration section of each script as needed (Sonos, Google Home, mobile device, etc).
3. **Connect the nodes** according to your desired notification flow (e.g., priority assignment → TTS → notification).
4. **Customize filtering** (e.g., target counties, time windows) in the config sections.
5. **Deploy your flow** and test with sample NWS alert payloads.

These function nodes are designed to be used in Node-RED flows for:

- Receiving and processing weather alerts from Home Assistant or NWS feeds
- Filtering, formatting, and prioritizing alerts for different notification channels
- Sending TTS announcements to speakers and mobile devices
- Managing notification timing and duplicate suppression

## Customization

- **Target Counties:**
  - Edit the `targetCounties` array in the TTS scripts to match your local area.
- **Alert Sounds:**
  - Update the `alertSounds` config for custom sound files and delays.
- **Notification Services:**
  - Set up your Pushover, Gotify, or mobile app tokens/IDs in the relevant scripts.
- **Time Restrictions:**
  - Adjust allowed hours and bypass events in `time_condition.js`.

## Example Flow

1. **priority_alerts.js**: Assigns priority and deduplicates incoming alerts.
2. **gotify_alert.js** / **pushover_alert.js**: Formats and sends push notifications.
3. **process_alert_tts.js** / **weather_tts_mobile.js**: Delivers TTS announcements to speakers or mobile devices.
4. **time_condition.js**: Ensures notifications are sent only during allowed hours (except for critical events).

## Notes

- All scripts use Node-RED's logging and status APIs for debugging and monitoring.
- County and area filtering is customizable in each script.
- This is just the start—more weather alert logic and integrations can be added in the future.
- See comments in each script for configuration and extension tips.

---

For more details, see comments in each script file.
