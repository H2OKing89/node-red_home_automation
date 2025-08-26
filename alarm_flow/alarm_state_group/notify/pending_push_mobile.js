// Node-RED Function Node: Multi-Device TTS Notification (Android & iOS)
// Sends a TTS message to every device mapped for a user when they're home, supporting both Android and iOS.

const notifyMapAndroidRaw = env.get("NOTIFY_MAP_ANDROID");
const notifyMapIOSRaw = env.get("NOTIFY_MAP_IOS");
const notifyMapAndroid = typeof notifyMapAndroidRaw === 'string' ? JSON.parse(notifyMapAndroidRaw) : (notifyMapAndroidRaw || {});
const notifyMapIOS = typeof notifyMapIOSRaw === 'string' ? JSON.parse(notifyMapIOSRaw) : (notifyMapIOSRaw || {});
const pushMessage = env.get("ALARM_PENDING_PUSH");

if (!msg.data) {
    node.error('msg.data is undefined');
    return null;
}

const { entity_id: entityId, state } = msg.data;

if (state !== "home") {
    node.warn(`${entityId} is not home, skipping PUSH.`);
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
    node.warn(`No notify actions found for ${entityId}`);
    return null;
}

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
            title: '\u200B<b><span style="color: red">"DISABLE THE ALARM"</span></b>',
            data: {
                priority: 'high',
                sticky: 'true',
                clickAction: '/lovelace-kiosk/Alarm',
                timeout: 600,
                ttl: 0,
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

node.log(`Building notification for entity: ${entityId}`);
node.debug(`Android actions: ${JSON.stringify(androidActions)}`);
node.debug(`iOS actions: ${JSON.stringify(iosActions)}`);
node.debug(`notifyMapIOS: ${JSON.stringify(notifyMapIOS)}, entityId: ${entityId}`);
node.debug(`Output messages: ${JSON.stringify(outMsgs)}`);

return [outMsgs]; // Flat array of messages for Node-RED