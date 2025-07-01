// Node-RED Function Node: Multi-Device TTS Notification
// Sends a TTS message to every device mapped for a user when they're home.

const notifyMapAndroid = global.get("notifyMapAndroid");
const ttsMessage = global.get("alarmTriggeredTTS");

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

// Removed home check; always proceed

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
            // This 'data' key is used for TTS parameters. how home assistant expects it. do not rename it.
            data: {
                ttl: 0,
                priority: "high",
                media_stream: "alarm_stream_max",
                tts_text: tts
            }
        }
    }
}));

return [outMsgs]; // Sends all messages out the first output
