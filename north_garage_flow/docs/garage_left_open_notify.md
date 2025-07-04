# Garage Left Open Notification Script

## Overview

The `garage_left_open_notify.js` script is a Node-RED function node that sends notifications and TTS (Text-to-Speech) messages when the garage door is left open and is automatically closed by the automation system. It supports both push notifications to mobile devices and voice announcements to smart speakers.

## Features

* **Multi-platform notifications**: Supports both Android and iOS push notifications
* **TTS support**: Works with Sonos speakers and Google Home devices
* **Environment-based configuration**: Uses Node-RED environment variables for flexible device management
* **Robust error handling**: Validates configuration and prevents empty device arrays
* **Debug logging**: Provides detailed logging for troubleshooting

## Configuration

### Required Environment Variables

The script requires three environment variables to be configured in Node-RED:

#### TTSDEVICES

This variable defines the TTS devices (speakers) that will announce the garage closure. The value must be a **flat JSON object** with `sonos` and `google` arrays. **Do not nest under a 'TTSdevices' key.**

**Format:**

```json
{
  "sonos": [
    "media_player.sonos_1",
    "media_player.bedroom_sonos_amp",
    "media_player.era_100"
  ],
  "google": [
    "media_player.kitchen_home_mini",
    "media_player.garage_home_mini",
    "media_player.family_room_home_mini",
    "media_player.basement_bedroom_hub2"
  ]
}
```

**Structure:**

* `sonos`: Array of Home Assistant Sonos speaker entity IDs
* `google`: Array of Home Assistant Google Home/Nest speaker entity IDs

#### NOTIFY\_MAP\_ANDROID

This variable maps notification keys to Android device notification services. The script looks for the `garage_notify` key.

**Format:**

```json
{
  "garage_notify": [
    "notify.mobile_app_quentin_s25u",
    "notify.mobile_app_quentin_g7u"
  ]
}
```

**Structure:**

* `garage_notify`: Array of Home Assistant Android mobile app notification service names (with "notify." prefix)

#### NOTIFY\_MAP\_IOS

This variable maps notification keys to iOS device notification services. The script looks for the `garage_notify` key.

**Format:**

```json
{
  "garage_notify": [
    "notify.mobile_app_quentin_ipad_pro_13"
  ]
}
```

**Structure:**

* `garage_notify`: Array (or single string) of Home Assistant iOS mobile app notification service names (with "notify." prefix)

### Setting Environment Variables in Node-RED

1. Open Node-RED settings (usually in `settings.js`)
2. Add the environment variables to the `functionGlobalContext` or use the Node-RED environment variable system
3. Alternatively, set them as system environment variables before starting Node-RED

**Examples:**

`NOTIFY_MAP_ANDROID`

```json
{
  "garage_notify": [
    "notify.mobile_app_quentin_s25u",
    "notify.mobile_app_roxy_s25u",
    "notify.mobile_app_quentin_g7u"
  ]
}
```

`NOTIFY_MAP_IOS`

```json
{
  "garage_notify": [
    "notify.mobile_app_quentin_ipad_pro_13",
    "notify.mobile_app_sylphiette_iphone_16pro",
    "notify.mobile_app_eris_iphone_16pro_max"
  ]
}
```

`TTSDEVICES`

```json
{
  "sonos": [
    "media_player.sonos_1",
    "media_player.bedroom_sonos_amp",
    "media_player.era_100"
  ],
  "google": [
    "media_player.kitchen_home_mini",
    "media_player.garage_home_mini",
    "media_player.family_room_home_mini",
    "media_player.basement_bedroom_hub2"
  ]
}
```

## Usage

This function expects to receive messages from the `cover_state.handler.js` output 3 with the following payload structure:

```json
{
  "payload": {
    "message": "Timer expired, closing garage cover",
    "openDurationSeconds": 1800
  }
}
```

## Output Structure

The function returns an array with two outputs:

### Output 1: Push Notifications

An array of notification messages for all configured mobile devices (Android and iOS).

### Output 2: TTS Messages

An array containing:

1. Sonos TTS payload (`media_player.play_media`)
2. Google volume control payload (`media_player.volume_set`)
3. Google TTS payload (`tts.google_say`)

## Configuration Options

### TTS Configuration

```javascript
const ttsConfig = {
    devices: ttsDevices, // Loaded from TTSDEVICES env var
    volumes: { sonos: 100 }, // Sonos volume level (0-100)
    googleVolume: 1.0 // Google speaker volume (0.0-1.0)
};
```

### Timezone

```javascript
const timeZone = 'America/Chicago'; // Set your desired timezone
```

## Message Formatting

### Push Notifications

* **Android**: HTML-formatted with colored text and styling
* **iOS**: Plain text with standard formatting
* **Both**: Include duration and timestamp

### TTS Messages

* Plain text optimized for speech
* Includes duration and formatted timestamp
* Same message content for both Sonos and Google speakers

## Error Handling

* Validates required input payload structure
* Checks for empty device arrays before creating TTS payloads
* Logs warnings for missing configuration
* Filters out null payloads to prevent Home Assistant errors

## Usage Example

1. Connect `cover_state.handler.js` output 3 to this function's input
2. Connect output 1 to Home Assistant call service nodes for notifications
3. Connect output 2 to Home Assistant call service nodes for TTS
4. Configure environment variables with your device entity IDs

## Integration

This function is designed to work as part of the garage automation flow:

```plaintext
cover_state.handler.js → garage_left_open_notify.js → [Notification Services]
                                                    → [TTS Services]
```

When the garage door timer expires and the door is automatically closed, this function creates appropriate notifications to inform users about the automated action.
