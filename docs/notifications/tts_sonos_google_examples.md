# Home Assistant TTS Payload Templates for Sonos & Google Speakers

This document provides templates and examples for constructing the `payload.message` and related fields for Home Assistant TTS (Text-to-Speech) notifications, specifically for Sonos and Google speakers. Use these as a reference for Node-RED function nodes or direct Home Assistant Action calls.

**Important:** As of 2025, Home Assistant changed the TTS API for non-Sonos speakers (Google, Apple, etc.) to use the `tts.speak` action instead of device-specific actions like `tts.google_say`.

---

## Sonos TTS Example (media_player.play_media)

**Action:** `media_player.play_media`

**Payload Template:**

```json
{
  "action": "media_player.play_media",
  "target": { "entity_id": ["media_player.sonos_1"] },
  "data": {
    "media_content_id": "media-source://tts/google_translate?message=YOUR_MESSAGE_HERE",
    "media_content_type": "music",
    "announce": true,
    "extra": { "volume": 100 }
  }
}
```

**Notes:**

- `media_content_id` must be URL-encoded. Wrap the message in quotes for clarity.
- `announce: true` ensures the message interrupts current playback.
- `extra.volume` sets the playback volume (0-100).

**Example (Single Sonos):**

```json
{
  "action": "media_player.play_media",
  "target": { "entity_id": ["media_player.sonos_1"] },
  "data": {
    "media_content_id": "media-source://tts/google_translate?message=%22The%20garage%20door%20is%20open.%22",
    "media_content_type": "music",
    "announce": true,
    "extra": { "volume": 80 }
  }
}
```

**Example (Multiple Sonos Speakers):**

```json
{
  "action": "media_player.play_media",
  "target": { "entity_id": [
    "media_player.sonos_1",
    "media_player.bedroom_sonos_amp",
    "media_player.era_100"
  ] },
  "data": {
    "media_content_id": "media-source://tts/google_translate?message=%22The%20garage%20door%20is%20open.%22",
    "media_content_type": "music",
    "announce": true,
    "extra": { "volume": 90 }
  }
}
```

---

## Google TTS Example (tts.speak) - NEW API (2025+)

**Action:** `tts.speak`

**Payload Template:**

```json
{
  "action": "tts.speak",
  "target": { "entity_id": "tts.google_translate_en_com" },
  "data": {
    "cache": true,
    "media_player_entity_id": ["media_player.living_room_speaker"],
    "message": "YOUR_MESSAGE_HERE"
  }
}
```

**Notes:**

- Uses the TTS service entity (e.g., `tts.google_translate_en_com`) as the target
- `media_player_entity_id` specifies which speaker(s) to play on
- `message` is plain text (no special encoding needed)
- `cache: true` improves performance by caching generated audio

**Example (Single Google Speaker):**

```json
{
  "action": "tts.speak",
  "target": { "entity_id": "tts.google_translate_en_com" },
  "data": {
    "cache": true,
    "media_player_entity_id": "media_player.living_room_speaker",
    "message": "The garage door was left open for 3 minutes and 5 seconds, and has been closed automatically."
  }
}
```

**Example (Multiple Google Speakers):**

```json
{
  "action": "tts.speak",
  "target": { "entity_id": "tts.google_translate_en_com" },
  "data": {
    "cache": true,
    "media_player_entity_id": [
      "media_player.living_room_speaker",
      "media_player.kitchen_speaker",
      "media_player.office_speaker"
    ],
    "message": "The garage door was left open for 3 minutes and 5 seconds, and has been closed automatically."
  }
}
```

---

## Apple HomeKit TTS Example (tts.speak)

**Action:** `tts.speak`

**Payload Template:**

```json
{
  "action": "tts.speak",
  "target": { "entity_id": "tts.apple_say" },
  "data": {
    "cache": true,
    "media_player_entity_id": ["media_player.homepod_living_room"],
    "message": "YOUR_MESSAGE_HERE"
  }
}
```

**Example:**

```json
{
  "action": "tts.speak",
  "target": { "entity_id": "tts.apple_say" },
  "data": {
    "cache": true,
    "media_player_entity_id": [
      "media_player.homepod_living_room",
      "media_player.homepod_bedroom"
    ],
    "message": "The alarm has been armed."
  }
}
```

---

## Legacy Google TTS Example (tts.google_say) - DEPRECATED

> **⚠️ This API is deprecated and may be removed in future Home Assistant versions. Use `tts.speak` instead.**

**Action:** `tts.google_say`

**Payload Template:**

```json
{
  "action": "tts.google_say",
  "target": { "entity_id": ["media_player.living_room_speaker"] },
  "data": {
    "message": "YOUR_MESSAGE_HERE",
    "cache": false
  }
}
```

**Notes:**

- `message` is plain text (no special encoding needed).
- `cache: false` ensures the message is always generated fresh.

**Example (Single Google Speaker):**

```json
{
  "action": "tts.google_say",
  "target": { "entity_id": ["media_player.living_room_speaker"] },
  "data": {
    "message": "The garage door was left open for 3 minutes and 5 seconds, and has been closed automatically.",
    "cache": false
  }
}
```

**Example (Multiple Google Speakers):**

```json
{
  "action": "tts.google_say",
  "target": { "entity_id": [
    "media_player.living_room_speaker",
    "media_player.kitchen_speaker",
    "media_player.office_speaker"
  ] },
  "data": {
    "message": "The garage door was left open for 3 minutes and 5 seconds, and has been closed automatically.",
    "cache": false
  }
}
```

---

## Google Speaker Volume Example

**Action:** `media_player.volume_set`

**Payload Template:**

```json
{
  "action": "media_player.volume_set",
  "target": { "entity_id": ["media_player.living_room_speaker"] },
  "data": { "volume_level": 0.8 }
}
```

**Example (Multiple Google Speakers):**

```json
{
  "action": "media_player.volume_set",
  "target": { "entity_id": [
    "media_player.living_room_speaker",
    "media_player.kitchen_speaker"
  ] },
  "data": { "volume_level": 0.7 }
}
```

---

## Tips

- **Sonos:** Always URL-encode the message and wrap it in quotes for best clarity. Sonos uses `media_player.play_media` with special TTS media source URLs.
- **Google/Apple/Other speakers:** Use the new `tts.speak` action with the appropriate TTS service entity (e.g., `tts.google_translate_en_com`, `tts.apple_say`).
- **Volume control:** Set volume before sending the TTS message using `media_player.volume_set` (wait ~400ms between commands).
- **Multiple speakers:** Use arrays for `media_player_entity_id` when sending to multiple devices.
- **Caching:** Use `cache: true` for better performance with repeated messages.

### Common TTS Service Entities

- Google Translate: `tts.google_translate_en_com` (or other language codes)
- Apple HomeKit: `tts.apple_say`
- Amazon Polly: `tts.amazon_polly`
- Microsoft Azure: `tts.microsoft_tts`
- Piper: `tts.piper`

---

Last updated: October 5, 2025
