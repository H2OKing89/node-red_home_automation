/**
 * Node-RED Function Node: Multi-Device Push Notification (Android & iOS)
 * Sends push notifications to configured devices when alarm is disabled
 * 
 * @param {Object} msg - The incoming message object
 * @param {Object} msg.data - Contains entity_id and state information
 * @param {string} msg.data.entity_id - Home Assistant person entity ID
 * @param {string} msg.data.state - Person's current state (home/not_home)
 * @param {string} [msg.push_text] - Optional override for push notification text
 * @param {Object} [msg.alarm] - Optional alarm information
 * @param {string} [msg.alarm.message] - Additional alarm message to display
 * @returns {Array} Array of notification messages for configured devices
 * @version 1.1.0
 */

(async () => {
try {
    node.status({ fill: "blue", shape: "dot", text: "Building notification..." });
    const notifyMapAndroidRaw = env.get("NOTIFY_MAP_ANDROID");
    const notifyMapIOSRaw = env.get("NOTIFY_MAP_IOS");
    const notifyMapAndroid = typeof notifyMapAndroidRaw === 'string' ? JSON.parse(notifyMapAndroidRaw) : (notifyMapAndroidRaw || {});
    const notifyMapIOS = typeof notifyMapIOSRaw === 'string' ? JSON.parse(notifyMapIOSRaw) : (notifyMapIOSRaw || {});
    const pushMessage = env.get("ALARM_DISABLED_PUSH");

    if (!msg.data) {
        node.status({ fill: "red", shape: "ring", text: "Error: msg.data undefined" });
        node.error('msg.data is undefined', msg);
        node.done();
        return null;
    }

const { entity_id: entityId, state } = msg.data;

if (state !== "home") {
    node.status({ fill: "yellow", shape: "ring", text: `${entityId} not home - skipped` });
    node.warn(`${entityId} is not home, skipping PUSH.`);
    node.done();
    return null;
}

const androidActions = notifyMapAndroid && notifyMapAndroid[entityId]
    ? (Array.isArray(notifyMapAndroid[entityId]) ? notifyMapAndroid[entityId] : [notifyMapAndroid[entityId]]).filter(Boolean)
    : [];
const iosActions = notifyMapIOS && notifyMapIOS[entityId]
    ? (Array.isArray(notifyMapIOS[entityId]) ? notifyMapIOS[entityId] : [notifyMapIOS[entityId]]).filter(Boolean)
    : [];

const push = msg.push_text || pushMessage;

if (androidActions.length === 0 && iosActions.length === 0) {
    node.status({ fill: "yellow", shape: "ring", text: `No actions for ${entityId}` });
    node.warn(`No notify actions found for ${entityId}`);
    node.done();
    return null;
}


const alarmMessage = msg.alarm && msg.alarm.message ? `<b><span style="color: green">${msg.alarm.message}</span></b>` : '';
const notificationMessage = `\u200B<b><span style="color: blue">${push}</span></b>` + (alarmMessage ? '\n\n' + alarmMessage : '');



// Remove HTML for iOS
function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\u200B/g, '');
}

const androidPayload = (action) => ({
    payload: {
        action,
        data: {
            message: notificationMessage,
            title: '\u200B<b><span style="color: green">ALARM IS NOW DISABLED</span></b>',
            data: {
                priority: 'high',
                sticky: false,
                clickAction: '/lovelace-kiosk/Alarm',
                timeout: 600,
                ttl: 300,
                tag: 'alarmo_armed_status',
                persistent: true,
                color: '#ffff05',
                channel: 'alarm_pending',
                importance: 'high',
                icon_url: 'https://picsur.kingpaging.com/i/f75fabb5-fbda-492f-9d15-8f39f5bd17d1.png',
                group: 'disabled',
                notification_icon: 'mdi:alarm-light-off'
            }
        }
    }
});

const iosPayload = (action) => ({
    payload: {
        action,
        data: {
            message: stripHtml(notificationMessage),
            title: stripHtml('ALARM IS NOW DISABLED'),
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

    const outMsgs = [];
    androidActions.forEach(action => outMsgs.push(androidPayload(action)));
    iosActions.forEach(action => outMsgs.push(iosPayload(action)));

    // Store notification history in context
    const history = node.context().get('notification_history') || [];
    history.push({
        timestamp: new Date().toISOString(),
        entity: entityId,
        type: 'push',
        state: 'disabled',
        recipients: androidActions.length + iosActions.length,
        android: androidActions.length,
        ios: iosActions.length
    });
    if (history.length > 50) history.shift();
    node.context().set('notification_history', history);

    node.status({ fill: "green", shape: "dot", text: `Sent to ${outMsgs.length} devices` });
    node.log(`Building notification for entity: ${entityId} (${androidActions.length} Android, ${iosActions.length} iOS)`);
    
    node.done();
    return [outMsgs];

} catch (error) {
    node.status({ fill: "red", shape: "ring", text: "Error: " + error.message });
    node.error(error, msg);
    node.done();
    return null;
}
})();


