/**
 * Node-RED Function Node: Multi-Device TTS Notification
 * Sends TTS messages to configured Android devices when user is home and alarm is pending
 * 
 * @param {Object} msg - The incoming message object
 * @param {Object} msg.data - Contains entity_id and state information
 * @param {string} msg.data.entity_id - Home Assistant person entity ID
 * @param {string} msg.data.state - Person's current state (home/not_home)
 * @param {string} [msg.tts_text] - Optional override for TTS message text
 * @returns {Array} Array of TTS messages for configured devices
 */

try {
    const notifyMapAndroidRaw = env.get("NOTIFY_MAP_ANDROID");
    const notifyMapAndroid = typeof notifyMapAndroidRaw === 'string' ? JSON.parse(notifyMapAndroidRaw) : (notifyMapAndroidRaw || {});
    const ttsMessage = env.get("ALARM_PENDING_TTS");

    if (!msg.data) {
        node.error('msg.data is undefined', msg);
        return null;
    }

    if (typeof notifyMapAndroid !== 'object' || notifyMapAndroid === null) {
        node.error('notifyMapAndroid must be a non-null object', msg);
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
                data: {
                    ttl: 300,
                    priority: "high",
                    media_stream: "alarm_stream_max",
                    tts_text: tts
                }
            }
        }
    }));

    node.log(`Building TTS notification for entity: ${entityId} (${actions.length} devices)`);
    
    return [outMsgs]; // Sends all messages out the first output

} catch (error) {
    node.error(`Error processing TTS notification: ${error.message}`, msg);
    return null;
}
