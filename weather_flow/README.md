# Node-RED Weather Alert Flow

This repository contains Node-RED function nodes and scripts for processing, filtering, and announcing National Weather Service (NWS) weather alerts. The flows are designed to deliver concise, relevant, and actionable notifications to your home audio devices, mobile devices, and notification services.

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

## Files Overview

- `priority_alerts.js` — Assigns priorities, deduplicates, and validates incoming alert payloads.
- `process_alert_tts.js` — Main TTS announcement logic for Sonos/Google Home, with advanced filtering and error handling.
- `process_alert_tts_mobile.js` — Sends TTS weather alerts to a mobile device via Home Assistant.
- `pushover_alert.js` — Formats and sends weather alerts to Pushover with HTML, emoji, and length validation.
- `gotify_alert.js` — Formats and sends weather alerts to Gotify with markdown, art, and meta info.
- `time_condition.js` — Restricts notifications to a time window, with bypass for critical events.

## Usage

1. **Import the function nodes into your Node-RED flow.**
2. **Configure device/entity IDs** in the configuration section of each script as needed (Sonos, Google Home, mobile device, etc).
3. **Connect the nodes** according to your desired notification flow (e.g., priority assignment → TTS → notification).
4. **Customize filtering** (e.g., target counties, time windows) in the config sections.
5. **Deploy your flow** and test with sample NWS alert payloads.

## Customization

- **Target Counties:**
  - Edit the `targetCounties` array in the TTS scripts to match your local area.
- **Alert Sounds:**
  - Update the `alertSounds` config for custom sound files and delays.
- **Notification Services:**
  - Set up your Pushover, Gotify, or mobile app tokens/IDs in the relevant scripts.
- **Time Restrictions:**
  - Adjust allowed hours and bypass events in `time_condition.js`.

## Requirements

- Node-RED (latest recommended)
- Home Assistant (for media player and mobile integrations)
- (Optional) Pushover, Gotify, and Sonos/Google Home integrations
- (Optional) Moment.js for advanced time handling (see `time_condition.js`)

## Author

Quentin

## License

MIT License

---

*For questions, improvements, or bug reports, please open an issue or pull request on this repository.*
