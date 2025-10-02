/**
 * Node-RED Function Node: Multi-Device Push Notification (Android & iOS)
 * Sends push notifications to configured devices when alarm is pending
 * 
 * @param {Object} msg - The incoming message object
 * @param {Object} msg.data - Contains entity_id and state information
 * @param {string} msg.data.entity_id - Home Assistant person entity ID
 * @param {string} msg.data.state - Person's current state (home/not_home)
 * @param {string} [msg.push_text] - Optional override for push notification text
 * @param {Object} [msg.alarm] - Optional alarm information
 * @param {string} [msg.alarm.message] - Additional alarm message to display
 * @returns {Array} Array of notification messages for configured devices
 */

try {
    const notifyMapAndroidRaw = env.get("NOTIFY_MAP_ANDROID");
    const notifyMapIOSRaw = env.get("NOTIFY_MAP_IOS");
    const notifyMapAndroid = typeof notifyMapAndroidRaw === 'string' ? JSON.parse(notifyMapAndroidRaw) : (notifyMapAndroidRaw || {});
    const notifyMapIOS = typeof notifyMapIOSRaw === 'string' ? JSON.parse(notifyMapIOSRaw) : (notifyMapIOSRaw || {});
    const pushMessage = env.get("ALARM_PENDING_PUSH");

    if (!msg.data) {
        node.status({ fill: "red", shape: "ring", text: "Error: msg.data undefined" });
        node.error('msg.data is undefined', msg);
        node.done();
        return null;
    }

const { entity_id: entityId, state } = msg.data;

if (state !== "home") {
    node.log(`${entityId} is not home, skipping PUSH.`);
    node.done();
    return null;
}

// Get Android and iOS notify actions (can be string, array, or null)
const androidActions = notifyMapAndroid && notifyMapAndroid[entityId]
    ? (Array.isArray(notifyMapAndroid[entityId]) ? notifyMapAndroid[entityId] : [notifyMapAndroid[entityId]]).filter(Boolean)
    : [];
const iosActions = notifyMapIOS && notifyMapIOS[entityId]
    ? (Array.isArray(notifyMapIOS[entityId]) ? notifyMapIOS[entityId] : [notifyMapIOS[entityId]]).filter(Boolean)
    : [];

const push = msg.push_text || pushMessage;

if (androidActions.length === 0 && iosActions.length === 0) {
    node.log(`No notify actions found for ${entityId}`);
    node.done();
    return null;
}

    node.status({ fill: "blue", shape: "dot", text: "Building notifications..." });
    
    const alarmMessage = msg.alarm && msg.alarm.message ? `<b><span style=\"color: red\">${msg.alarm.message}</span></b>` : '';
const notificationMessage = `\u200B<b><span style="color: blue">${push}</span></b>` + (alarmMessage ? '\n\n' + alarmMessage : '');

// Remove HTML for iOS
function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\u200B/g, '');
}

// Android payload template
const androidPayload = (action) => ({
    payload: {
        action,
        data: {
            message: notificationMessage,
            title: '\u200B<b><span style="color: red">DISABLE THE ALARM</span></b>',
            data: {
                priority: 'high',
                sticky: true,
                clickAction: '/lovelace-kiosk/Alarm',
                timeout: 600,
                ttl: 300,
                tag: 'alarmo_armed_status',
                persistent: true,
                color: '#ffff05',
                channel: 'alarm_pending',
                importance: 'high',
                chronometer: true,
                when: 60,
                when_relative: true,
                icon_url: 'https://picsur.kingpaging.com/i/f75fabb5-fbda-492f-9d15-8f39f5bd17d1.png',
                group: 'disabled',
                notification_icon: 'mdi:alarm-light'
            }
        }
    }
});

// iOS payload template (no HTML)
const iosPayload = (action) => ({
    payload: {
        action,
        data: {
            message: stripHtml(notificationMessage),
            title: stripHtml('DISABLE THE ALARM'),
            data: {
                push: {
                    sound: { name: 'default', critical: 1, volume: 1.0 },
                    'interruption-level': 'time-sensitive',
                    badge: 1
                },
                tag: 'alarmo_armed_status',
                persistent: true,
                url: '/lovelace-kiosk/Alarm'
            }
        }
    }
});

    // Build a flat array of messages for both platforms
    const outMsgs = [];
    androidActions.forEach(action => outMsgs.push(androidPayload(action)));
    iosActions.forEach(action => outMsgs.push(iosPayload(action)));

    node.status({ fill: "green", shape: "dot", text: `Sent to ${outMsgs.length} devices` });
    node.log(`Building notification for entity: ${entityId} (${androidActions.length} Android, ${iosActions.length} iOS)`);
    node.debug(`Android actions: ${JSON.stringify(androidActions)}`);
    node.debug(`iOS actions: ${JSON.stringify(iosActions)}`);

    node.done();
    return [outMsgs]; // Flat array of messages for Node-RED

} catch (error) {
    node.status({ fill: "red", shape: "ring", text: "Error: " + error.message });
    node.error(error, msg);
    node.done();
    return null;
}