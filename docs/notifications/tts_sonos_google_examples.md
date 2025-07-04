# Home Assistant TTS Payload Templates for Sonos & Google Speakers

This document provides templates and examples for constructing the `payload.message` and related fields for Home Assistant TTS (Text-to-Speech) notifications, specifically for Sonos and Google speakers. Use these as a reference for Node-RED function nodes or direct Home Assistant Action calls.

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

## Google TTS Example (tts.google_say)

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

- For Sonos, always URL-encode the message and wrap it in quotes for best clarity.
- For Google, use plain text and set volume before sending the TTS message if needed.
- Use arrays for `entity_id` if sending to multiple speakers.
- For multi-step announcements (volume, then TTS), send the volume command first, then the TTS command after a short delay (e.g., 400ms).

---

Last updated: June 28, 2025
