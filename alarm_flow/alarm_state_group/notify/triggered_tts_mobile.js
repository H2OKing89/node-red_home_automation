/**
 * Node-RED Function Node: Multi-Device TTS Notification
 * Sends TTS messages to configured Android devices when alarm is triggered
 * NOTE: No home state check - everyone should be notified when alarm is triggered
 * 
 * @param {Object} msg - The incoming message object
 * @param {Object} msg.data - Contains entity_id and state information
 * @param {string} msg.data.entity_id - Home Assistant person entity ID
 * @param {string} msg.data.state - Person's current state (home/not_home)
 * @param {string} [msg.tts_text] - Optional override for TTS message text
 * @returns {Array} Array of TTS messages for configured devices
 * @version 1.1.0
 */

(async () => {
try {
    node.status({ fill: "blue", shape: "dot", text: "Building TRIGGERED TTS..." });
    const notifyMapAndroidRaw = env.get("NOTIFY_MAP_ANDROID");
    const notifyMapAndroid = typeof notifyMapAndroidRaw === 'string' ? JSON.parse(notifyMapAndroidRaw) : (notifyMapAndroidRaw || {});
    const ttsMessage = env.get("ALARM_TRIGGERED_TTS");

    if (!msg.data) {
        node.status({ fill: "red", shape: "ring", text: "Error: msg.data undefined" });
        node.error('msg.data is undefined', msg);
        node.done();
        return null;
    }

    if (typeof notifyMapAndroid !== 'object' || notifyMapAndroid === null) {
        node.status({ fill: "red", shape: "ring", text: "Error: Invalid config" });
        node.error('notifyMapAndroid must be a non-null object', msg);
        node.done();
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
    node.status({ fill: "yellow", shape: "ring", text: `No actions for ${entityId}` });
    node.warn(`No notify actions found for ${entityId}`);
    node.done();
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
                    ttl: 300,
                    priority: "high",
                    media_stream: "alarm_stream_max",
                    tts_text: tts
                }
            }
        }
    }));

    // Store notification history in context
    const history = node.context().get('notification_history') || [];
    history.push({
        timestamp: new Date().toISOString(),
        entity: entityId,
        type: 'tts',
        state: 'triggered',
        recipients: actions.length
    });
    if (history.length > 50) history.shift();
    node.context().set('notification_history', history);

    node.status({ fill: "red", shape: "dot", text: `🚨 TRIGGERED - Sent to ${actions.length} devices` });
    node.log(`Building TTS notification for entity: ${entityId} (${actions.length} devices) - TRIGGERED ALARM`);
    
    node.done();
    return [outMsgs]; // Sends all messages out the first output

} catch (error) {
    node.status({ fill: "red", shape: "ring", text: "Error: " + error.message });
    node.error(error, msg);
    node.done();
    return null;
}
})();
