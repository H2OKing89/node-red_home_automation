// Node-RED Function Node: Garage Door Left Open Notification
// Sends a notification to all mapped devices when the garage door was left open and is now being closed by automation.
// Expects input from output 3 of cover_state.handler.js
// Supports timezone-aware date formatting for push notifications and TTS messages.

const { formatInTimeZone } = dateFnsTz;
const timeZone = 'America/Chicago'; // Set your desired timezone here

// Get TTS devices from environment variable
const ttsDevicesRaw = env.get('TTSDEVICES');
const ttsDevices = typeof ttsDevicesRaw === 'string' ? JSON.parse(ttsDevicesRaw) : (ttsDevicesRaw || {"sonos":[],"google":[]});

// Configure Home Assistant entities devices for TTS and volume control
const ttsConfig = {
    devices: ttsDevices,
    volumes: { sonos: 100 }, // Sonos volume level (0-100)
    googleVolume: 1.0 // Google speaker volume (0.0-1.0) 1.0 = 100%
};

// Get notify maps from environment variables for Android and iOS entities for Home Assistant
const notifyMapAndroidRaw = env.get("NOTIFY_MAP_ANDROID");
const notifyMapIOSRaw = env.get("NOTIFY_MAP_IOS");
const notifyMapAndroid = typeof notifyMapAndroidRaw === 'string' ? JSON.parse(notifyMapAndroidRaw) : (notifyMapAndroidRaw || {});
const notifyMapIOS = typeof notifyMapIOSRaw === 'string' ? JSON.parse(notifyMapIOSRaw) : (notifyMapIOSRaw || {});

if (!msg.payload || !msg.payload.openDurationSeconds) {
    node.error('Missing openDurationSeconds in msg.payload');
    return null;
}

const openDuration = msg.payload.openDurationSeconds;
const minutes = Math.floor(openDuration / 60);
const seconds = openDuration % 60;
let durationText;
if (minutes > 0 && seconds > 0) {
    durationText = `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
} else if (minutes > 0) {
    durationText = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
} else if (seconds > 0) {
    durationText = `${seconds} second${seconds !== 1 ? 's' : ''}`;
} else {
    durationText = '';
}

// Get current date/time and format as 'June 27th, 2025 3:00 PM CST' for push, and 'June 27th, 2025 at 3:00 PM CST' for TTS
const now = new Date();

// Format for push and TTS, with and without 'at'
const formattedTimePush = formatInTimeZone(now, timeZone, "MMMM do, yyyy h:mm a zzz");
const formattedTimeTTS = formatInTimeZone(now, timeZone, "MMMM do, yyyy 'at' h:mm a zzz");

// HTML-formatted message for Android devices
const messageHtml = `\u200B<b><span style=\"color: #1565c0\">The garage door was left open for</span></b> \u200B<span style=\"color: #e65100\">${durationText}</span></b> <b><span style=\"color: #1565c0\">and has been closed automatically.</span></b><br><span style=\"color: #888\">${formattedTimePush}</span>`;
const titleHtml = '\u200B<b><span style=\"color: #1565c0\">Garage Door Closed by Automation</span></b>';
// Message construction for IOS devices
const message = `The garage door was left open for ${durationText} and has been closed automatically.\n${formattedTimePush}`;
const title = 'Garage Door Closed by Automation';


/* TTS message for Google and Sonos formatted as plain text for speaking */

const messageTTS = `The garage door was left open for ${durationText} by some dumbass, and has been closed automatically. on ${formattedTimeTTS}`;


const androidActions = notifyMapAndroid && notifyMapAndroid['garage_notify']
    ? (Array.isArray(notifyMapAndroid['garage_notify']) ? notifyMapAndroid['garage_notify'] : [notifyMapAndroid['garage_notify']]).filter(Boolean)
    : [];
const iosActions = notifyMapIOS && notifyMapIOS['garage_notify']
    ? (Array.isArray(notifyMapIOS['garage_notify']) ? notifyMapIOS['garage_notify'] : [notifyMapIOS['garage_notify']]).filter(Boolean)
    : [];

/* Android payload construction */
const androidPayload = (action) => ({
    payload: {
        action,
        data: {
            message: messageHtml,
            title: titleHtml,
            data: {
                priority: 'high',
                sticky: 'true',
                clickAction: '/lovelace-kiosk/kiosk-main',
                timeout: 600,
                ttl: 0,
                tag: 'garage_door_status',
                persistent: true,
                color: '#2196f3',
                channel: 'garage_alerts',
                importance: 'high',
                icon_url: 'https://cdn-icons-png.flaticon.com/512/69/69524.png',
                group: 'garage',
                notification_icon: 'mdi:garage'
            }
        }
    }
});

/* iOS payload construction */
const iosPayload = (action) => ({
    payload: {
        action,
        data: {
            message: message,
            title: title,
            data: {
                push: {
                    sound: { name: 'default', critical: 0, volume: 1.0 },
                    'interruption-level': 'active',
                    badge: 1
                },
                tag: 'garage_door_status',
                persistent: true,
                url: '/lovelace-kiosk/kiosk-main'
            }
        }
    }
});

/* Sonos payload construction */
function buildSonosPayload(messageText) {
    const encoded = encodeURIComponent(`"${messageText}"`);
    return {
        action: "media_player.play_media",
        target: { entity_id: ttsConfig.devices.sonos },
        data: {
            media_content_id: `media-source://tts/google_translate?message=${encoded}`,
            media_content_type: "music",
            announce: true,
            extra: { volume: ttsConfig.volumes.sonos }
        }
    };
}

/* Google volume payload construction */
function buildGoogleVolumePayload() {
    const level = Math.min(Math.max(ttsConfig.googleVolume, 0), 1);
    return {
        action: "media_player.volume_set",
        target: { entity_id: ttsConfig.devices.google },
        data: { volume_level: level }
    };
}
/* Google TTS payload construction */
function buildGoogleTtsPayload(messageText) {
    return {
        action: "tts.google_say",
        target: { entity_id: ttsConfig.devices.google },
        data: { cache: false, message: messageText }
    };
}

// Add TTS messages to outputs
// Use messageTTS for both Sonos and Google TTS
const sonosPayload = buildSonosPayload(messageTTS);
const googleVolumePayload = buildGoogleVolumePayload();
const googleTtsPayload = buildGoogleTtsPayload(messageTTS);

const outMsgs = [];
androidActions.forEach(action => outMsgs.push(androidPayload(action)));
iosActions.forEach(action => outMsgs.push(iosPayload(action)));

if (outMsgs.length === 0) {
    node.warn('No notify actions found for garage_notify');
    return null;
}

// Output 1: push notifications, Output 2: TTS payloads
return [outMsgs, [
    { payload: sonosPayload },
    { payload: googleVolumePayload },
    { payload: googleTtsPayload }
]];
