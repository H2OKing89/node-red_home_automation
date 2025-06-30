# alarm_flow

This directory contains Node-RED function nodes, handlers, and documentation for automating and managing your home alarm system. The flows are designed to provide robust, flexible, and extensible alarm logic, including state management, duress handling, notifications, and integration with smart locks and other devices.

## Features

- **Alarm State Management:**
  - Handles arming, disarming, pending, triggered, and duress states.
  - Supports state routing and failure event processing.

- **Duress and Failure Handling:**
  - Detects duress codes and processes duress events.
  - Handles alarm failure events and retries.

- **Notification Integrations:**
  - Sends push and TTS notifications for alarm events (pending, triggered, disabled, etc.)
  - Supports both mobile and TTS (Sonos/Google) notifications.

- **Smart Lock Integration:**
  - Disarms alarm via lock code entry.
  - Notifies on lock-related alarm events.

- **Extensible Logic:**
  - Modular structure for easy addition of new alarm event handlers and notification types.
  - Includes documentation for each major function node.

## Directory Structure

- `alarm_state_handler/` — Core alarm state logic, duress/failure processors, and notification handlers.
- `lock_disable_alarm/` — Logic for disarming alarm via smart lock and related notifications.
- `notify/` — TTS and push notification handlers for various alarm states.
- `doc/` — Markdown documentation for each handler and integration.

## Example Use Cases

- Automatically notify users when the alarm is pending, triggered, or disabled.
- Disarm the alarm using a smart lock code and notify users.
- Detect and process duress codes for enhanced security.
- Retry arming at night if the alarm fails to arm.

## Notes

- All logic is designed for use in Node-RED with Home Assistant and smart home integrations.
- Easily extensible for new alarm types, notification channels, or device integrations.
- See the `doc/` subdirectory and comments in each script for detailed usage and configuration.

---

For more details, see comments in each script file and the markdown docs in `doc/`.
