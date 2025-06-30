// Node-RED Function Node: Multi-Device TTS Notification (Android & iOS)
// Sends a TTS message to every device mapped for a user when the alarm is triggered, supporting both Android and iOS.

const notifyMapAndroid = global.get("notifyMapAndroid");
const notifyMapIOS = global.get("notifyMapIOS");
const pushMessage = global.get("alarmTriggeredPUSH");

if (!msg.data) {
    node.error('msg.data is undefined');
    return null;
}

const { entity_id: entityId } = msg.data;

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
const notificationMessage = (alarmMessage ? alarmMessage + '\n\n' : '') + '\u200B<b><span style="color: blue">PRESS HERE TO DISABLE THE ALARM</span></b>';

// Remove HTML for iOS
function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\u200B/g, '');
}

const androidPayload = (action) => ({
    payload: {
        action,
        data: {
            message: notificationMessage,
            title: '🚨\u200B<b><span style="color: red">"ALARM TRIGGERED"</span></b>🚨',
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

const iosPayload = (action) => ({
    payload: {
        action,
        data: {
            message: stripHtml(notificationMessage),
            title: stripHtml('🚨ALARM TRIGGERED🚨'),
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

return [outMsgs];