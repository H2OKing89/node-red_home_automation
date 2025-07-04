# north_garage_flow

This directory contains Node-RED function nodes and documentation for automating the North Garage, including door (cover) state management, interior lights automation, and notification logic.

## Files

- **cover_state.handler.js**
  - Manages the garage door (cover) automation, including timers, person detection, override logic, and auto-close functionality.
  - See detailed documentation in `doc/cover_state.handler.md`.

- **interior_lights.handler.js**
  - Automates the North Garage interior lights based on person detection, garage/house door events, and time of day (dusk/dawn).
  - See detailed documentation in `doc/interior_lights.handler.md`.

- **garage_left_open_notify.js**
  - Sends notifications and TTS messages when the garage door is left open and is closed automatically by automation.
  - Supports push notifications to Android/iOS and TTS to Sonos/Google Home speakers.
  - Requires environment variables for device configuration (see `doc/garage_left_open_notify.md`).
  - See detailed documentation in `doc/garage_left_open_notify.md`.

- **doc/**
  - Contains detailed markdown documentation for each handler and automation logic.

## Environment Variables

The notification script requires the following environment variables to be configured in Node-RED. See `doc/garage_left_open_notify.md` for detailed configuration instructions.

### TTSDEVICES

JSON array configuration for TTS speakers:

```json
[
  {
    "type": "sonos",
    "entity": "media_player.kitchen_sonos",
    "language": "en-us"
  },
  {
    "type": "google",
    "entity": "media_player.living_room_google_home",
    "language": "en"
  }
]
```

### NOTIFY_MAP_ANDROID

JSON object mapping users to Android notification services:

```json
{
  "quentin": "mobile_app_pixel_7_pro",
  "roxy": "mobile_app_samsung_galaxy"
}
```

### NOTIFY_MAP_IOS

JSON object mapping users to iOS notification services:

```json
{
  "sylphiette": "mobile_app_iphone_13",
  "eris": "mobile_app_ipad_pro"
}
```

## Usage

These function nodes are designed to be used in Node-RED flows for:

- Managing garage door open/close automation with timers and person detection
- Automating interior lights based on activity and daylight
- Sending notifications and TTS alerts for garage events

## Example Flow

1. **cover_state.handler.js**: Handles garage door state, timers, and triggers auto-close.
2. **interior_lights.handler.js**: Automates interior lights based on events and time of day.
3. **garage_left_open_notify.js**: Notifies users when the garage door is closed automatically after being left open.

## Notes

- All timer and state management is handled via Node-RED flow context.
- Designed for use with Home Assistant events and SunCalc/date-fns-tz for time calculations.
- Documentation for each handler is available in the `doc/` subdirectory.
- This is just the start—more garage automation logic and integrations can be added in the future.

---

For more details, see comments in each script file and the markdown docs in `doc/`.
