# Garage Left Open Notification Script

## Overview

The `garage_left_open_notify.js` script is a Node-RED function node that sends notifications and TTS (Text-to-Speech) messages when the garage door is left open and is automatically closed by the automation system. It supports both push notifications to mobile devices and voice announcements to smart speakers.

## Features

- **Multi-platform notifications**: Supports both Android and iOS push notifications
- **TTS support**: Works with Sonos speakers and Google Home devices
- **Environment-based configuration**: Uses Node-RED environment variables for flexible device management
- **Robust error handling**: Validates configuration and prevents empty device arrays
- **Debug logging**: Provides detailed logging for troubleshooting

## Configuration

### Required Environment Variables

The script requires three environment variables to be configured in Node-RED:

#### TTSDEVICES

This variable defines the TTS devices (speakers) that will announce the garage closure. The value should be a JSON array of device objects.

**Format:**

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

**Properties:**

- `type`: Speaker type - either "sonos" or "google"
- `entity`: Home Assistant entity ID for the speaker
- `language`: Language code for TTS (e.g., "en-us", "en", "es")

#### NOTIFY_MAP_ANDROID

This variable maps user names to their Android device notification services.

**Format:**

```json
{
  "quentin": "mobile_app_pixel_7_pro",
  "sarah": "mobile_app_samsung_galaxy"
}
```

**Structure:**

- Key: User name or identifier
- Value: Home Assistant mobile app service name (without "notify." prefix)

#### NOTIFY_MAP_IOS

This variable maps user names to their iOS device notification services.

**Format:**

```json
{
  "john": "mobile_app_iphone_13",
  "mary": "mobile_app_ipad_pro"
}
```

**Structure:**

- Key: User name or identifier  
- Value: Home Assistant mobile app service name (without "notify." prefix)

### Setting Environment Variables in Node-RED

1. Open Node-RED settings (usually in `settings.js`)
2. Add the environment variables to the `functionGlobalContext` or use the Node-RED environment variable system
3. Alternatively, set them as system environment variables before starting Node-RED

**Example in settings.js:**

```javascript
functionGlobalContext: {
    TTSDEVICES: JSON.stringify([
        {
            "type": "sonos",
            "entity": "media_player.kitchen_sonos",
            "language": "en-us"
        }
    ]),
    NOTIFY_MAP_ANDROID: JSON.stringify({
        "quentin": "mobile_app_pixel_7_pro"
    }),
    NOTIFY_MAP_IOS: JSON.stringify({
        "john": "mobile_app_iphone_13"
    })
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

- **Android**: HTML-formatted with colored text and styling
- **iOS**: Plain text with standard formatting
- **Both**: Include duration and timestamp

### TTS Messages

- Plain text optimized for speech
- Includes duration and formatted timestamp
- Same message content for both Sonos and Google speakers

## Error Handling

- Validates required input payload structure
- Checks for empty device arrays before creating TTS payloads
- Logs warnings for missing configuration
- Filters out null payloads to prevent Home Assistant errors

## Usage Example

1. Connect `cover_state.handler.js` output 3 to this function's input
2. Connect output 1 to Home Assistant call service nodes for notifications
3. Connect output 2 to Home Assistant call service nodes for TTS
4. Configure environment variables with your device entity IDs

## Integration

This function is designed to work as part of the garage automation flow:

``` plaintext
cover_state.handler.js → garage_left_open_notify.js → [Notification Services]
                                                    → [TTS Services]
```

When the garage door timer expires and the door is automatically closed, this function creates appropriate notifications to inform users about the automated action.
