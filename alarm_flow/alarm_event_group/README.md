# Alarm Failure Events Handler

## Overview

This function node handles events when an alarm system fails to arm or disarm, formatting appropriate messages for both TTS announcements (Sonos and Google) and mobile push notifications.

## Features

- Multi-platform TTS support (Sonos and Google speakers)
- Configurable speaker groups
- Push notifications with detailed information
- Actionable notifications with retry/force buttons for arm failures
- Robust error handling and dependency checking
- Timezone-aware date formatting

## Dependencies

This function requires the following modules to be added in the Node-RED function node's "Setup" tab:

- `date-fns` (Variable name: `dateFns`)
- `date-fns-tz` (Variable name: `dateFnsTz`)

## Configuration Options

The script includes several configuration sections at the top:

### Speaker Configuration

```javascript
const SONOS_SPEAKERS = [
    "media_player.sonos_1",
    "media_player.bedroom_sonos_amp",
    "media_player.era_100"
];

const GOOGLE_SPEAKERS = [
    "media_player.house_google_speakers"
];
```

Modify these arrays to include the entity IDs of your Sonos and Google speakers.

### TTS Configuration

```javascript
const TTS_VOLUME = 100; // 0-100 for Sonos speakers
const TTS_CACHE = false; // Whether to cache TTS messages for Google speakers
```

### Mobile Notification Configuration

```javascript
const MOBILE_DEVICES = {
    primary: "notify.mobile_app_quentin_s25u",
    others: [] // Add additional device services here if needed
};
```

Replace the primary value with your mobile app notification service.

### Message Configuration

```javascript
const MESSAGE_OPTIONS = {
    includeTimeInTTS: false,  // Whether to include the full timestamp in TTS announcements
    includeTimeInPush: true   // Whether to include the full timestamp in push notifications
};
```

## Outputs

This function node has 4 outputs:

1. **Sonos TTS**: Message formatted for Sonos speakers using `media_player.play_media` service
2. **Google TTS**: Message formatted for Google speakers using `tts.google_say` service
3. **Push Notification**: Simple push notification message
4. **Actionable Notification**: Enhanced notification with actionable buttons (for arm failures)

## Integration

To use this handler effectively:

1. Add the function node to your flow and configure the dependencies
2. Connect the 4 outputs to appropriate service call nodes
3. Send alarm failure events to the input with the correct payload structure

## Expected Input Payload Structure

```json
{
  "event_type": "alarmo_failed_to_arm",
  "event": {
    "command": "arm_home", // or other arm states
    "reason": "open_sensors",
    "sensors": ["binary_sensor.front_door", "binary_sensor.kitchen_window"],
    "time_fired": "2023-06-30T12:34:56.789Z"
  }
}
```

## Version History

See the changelog section at the top of the script for detailed version history.
