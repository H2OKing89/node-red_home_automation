// Node-RED Function Node: Multi-Device TTS Notification
// Sends a TTS message to every device mapped for a user when they're home.

const notifyMapAndroid = global.get("notifyMapAndroid");
const ttsMessage = global.get("alarmPendingTTS");

// REVIEW: Validate that msg.data exists to prevent errors if message structure changes
if (!msg.data) {
    node.error('msg.data is undefined');
    return null;
}

// REVIEW: Consider caching global.get calls if this function becomes a performance hotspot
if (typeof notifyMapAndroid !== 'object' || notifyMapAndroid === null) {
    node.error('notifyMapAndroid must be a non-null object');
    return null;
}

const { entity_id: entityId, state } = msg.data;

// Only proceed if the person is home
if (state !== "home") {
    node.warn(`${entityId} is not home, skipping TTS.`);
    return null;
}

// Retrieve list of notification actions; default to empty array
const actions = notifyMapAndroid[entityId]
    ? [].concat(notifyMapAndroid[entityId])
    : [];

const tts = msg.tts_text || ttsMessage;

if (actions.length === 0) {
    node.warn(`No notify actions found for ${entityId}`);
    return null;
}

// Home Assistant message format
// Build a payload for each device
const outMsgs = actions.map(action => ({
    payload: {
        action,
        data: {
            message: "TTS",
            // REVIEW: Rename nested 'data' key to 'params' to clarify its purpose
            data: {
                ttl: 0,
                priority: "high",
                media_stream: "alarm_stream_max",
                tts_text: 'Thank you for disabling the alarm, Now go in Peace and serve the Lord'
            }
        }
    }
}));

return [outMsgs]; // Sends all messages out the first output
