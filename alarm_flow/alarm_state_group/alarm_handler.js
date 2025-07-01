/**
 * Script Name: Alarm handler with Multi-Speaker TTS
 * Platform: Node-RED
 * Flow: House Alarm
 * Group: Comprehensive Alarm Management, Notifications, and Emergency Handling
 * Date: 2024-09-02 (Updated 2025-05-30)
 * Version: 1.3.1 
 * 1.3.1 change_log: fix
 * - Updated knownUsers list to include full names and added comment about global context.
 * - Added null checking: Before trying to access outputs[1], the code now checks if outputs is not null.
 *
 * Adds support for Google Home/Nest speakers, alongside Sonos, for TTS announcements.
 *
 */

// --- Speaker & Volume Configuration ---
const config = {
    devices: {
        sonos: [
            "media_player.sonos_1",
            "media_player.bedroom_sonos_amp",
            "media_player.era_100"
        ],
        google: [
            "media_player.house_google_speakers"
        ]
    },
    volumes: { sonos: 100 },      // Sonos volume level (0-100)
    googleVolume: 1.0,            // Google speaker volume (0.0-1.0)
    googleDelay: 400              // Delay before sending Google TTS payload (ms)
};

// --- Pushover Configuration ---
let PUSHOVER_ENABLED = true;
const PUSHOVER_PRIORITY = 1;
const PUSHOVER_SOUND = 'pushover';
const PUSHOVER_TOKEN = global.get('pushoverTokens')?.alarmToken;
const PUSHOVER_USER = global.get('pushoverUserKeys')?.quentinUserKey;
const axios = global.get('axios');

// Validate Pushover configuration and dependencies
const missingConfig = [];
if (!PUSHOVER_TOKEN) missingConfig.push('PUSHOVER_TOKEN');
if (!PUSHOVER_USER) missingConfig.push('PUSHOVER_USER');
if (!axios) missingConfig.push('axios');
if (missingConfig.length > 0) {
    const warningMsg = `Missing configuration: ${missingConfig.join(', ')}. Disabling Pushover notifications.`;
    node.warn(warningMsg);
    PUSHOVER_ENABLED = false;
}

// --- Delay Helper ---
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// --- Pushover Notification ---
const SCRIPT_NAME = 'Alarm handler with Multi-Speaker TTS';
async function sendPushoverNotification(message, title = 'Error Notification') {
    if (!PUSHOVER_ENABLED) return;
    // Always include script name in the title for traceability
    const fullTitle = `${SCRIPT_NAME}: ${title}`;
    const pushoverPayload = {
        token: PUSHOVER_TOKEN, user: PUSHOVER_USER, message, title: fullTitle,
        priority: PUSHOVER_PRIORITY, sound: PUSHOVER_SOUND
    };
    try {
        const response = await axios.post('https://api.pushover.net/1/messages.json', pushoverPayload);
        if (response.status === 200) node.log('Pushover notification sent successfully.');
        else node.error(`Failed to send Pushover notification. Status code: ${response.status}`);
    } catch (error) {
        node.error(`Error sending Pushover notification: ${error.message}`);
    }
}

async function handleError(error, context) {
    node.error(`Error: ${error.message}`);
    if (context) node.error(`Context: ${JSON.stringify(context)}`);
    await sendPushoverNotification(`Error: ${error.message}\nContext: ${JSON.stringify(context)}`);
    node.status({ fill: 'red', shape: 'ring', text: error.message });
}

// --- Load Global Configurations ---
// Use user-whitelist from global context for known users, matching alarm_state_router.js
const userWhitelist = global.get('user-whitelist', 'file') || {};
const knownUsers = Array.from(new Set([
  ...Object.values(userWhitelist)
    .filter(u => u.enabled && typeof u.full_name === 'string')
    .map(u => u.full_name.toLowerCase()),
  'system' // Always allow 'system' as a valid user for automations
]));
node.debug(`Loaded knownUsers from user-whitelist: ${JSON.stringify(knownUsers)}`);

// Sensor mappings remain unchanged
const sensorMappings = global.get('sensorMappings.file') ?? {
    'binary_sensor.back_basement_door': 'back basement door',
    'binary_sensor.back_door': 'back door',
    'binary_sensor.back_sliding_door': 'back sliding door',
    'binary_sensor.g5_dome_living_room_person_detected': 'family room',
    'binary_sensor.front_door': 'front door',
    'binary_sensor.north_garage': 'north garage door',
    'binary_sensor.panic_button_on': 'panic button',
    'binary_sensor.west_garage_entry_door': 'west garage door',
    'binary_sensor.g5_flex_north_garage_person_detected': 'north garage'
};
node.debug(`Loaded sensorMappings: ${JSON.stringify(sensorMappings)}`);

// --- Date Formatter ---
// Access dateFnsTz directly (no require needed, must be set up in Node-RED function node)
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

/**
 * Returns formatted date/time strings for push and TTS, using date-fns-tz.
 * If date-fns-tz is not available, returns a simple fallback string.
 */
function getFormattedTimes(date) {
    if (typeof formatInTimeZone !== 'function') {
        node.warn('[alarm_handler] date-fns-tz not available in global context. Returning ISO string.');
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
    return {
        formattedTimePush: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy h:mm a zzz"),
        formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, "MMMM do, yyyy 'at' h:mm a zzz")
    };
}

// --- Payload Generators ---
function buildSonosPayload(messageText) {
    const encoded = encodeURIComponent(`"${messageText}"`); // wrap in quotes
    return {
        action: "media_player.play_media",
        target: { entity_id: config.devices.sonos },
        data: {
            media_content_id: `media-source://tts/google_translate?message=${encoded}`,
            media_content_type: "music",
            announce: true,
            extra: { volume: config.volumes.sonos }
        }
    };
}
function buildGoogleVolumePayload() {
    const level = Math.min(Math.max(config.googleVolume, 0), 1);
    return {
        action: "media_player.volume_set",
        target: { entity_id: config.devices.google },
        data: { volume_level: level }
    };
}
function buildGoogleTtsPayload(messageText) {
    return {
        action: "tts.google_say",
        target: { entity_id: config.devices.google },
        data: { cache: false, message: messageText }
    };
}

// --- Helper to Build Combined TTS Output ---
function buildMultiTTS(ttsText) {
    return [
        { payload: buildSonosPayload(ttsText) },
        { payload: buildGoogleVolumePayload() },
        // The Google TTS should be sent after a delay (handled in main)
        { payload: buildGoogleTtsPayload(ttsText) }
    ];
}

// --- Helper Function to Create Notification + Multi-TTS ---
function createMessageMultiTTS(messageText, title, ttsText) {
    return {
        notification: { alarm: { message: messageText, title: title } },
        tts: buildMultiTTS(ttsText)
    };
}

// --- Output Object to Array (output indexes as before, but TTS index gets an array) ---
function buildOutputArray(output) {
    const outputs = Array(11).fill(null);
    if (output.disarmedNotification) outputs[0] = { ...output.disarmedNotification, msgType: "disarmed" };
    if (output.tts) outputs[1] = output.tts; // TTS remains an array, handled separately
    if (output.armedAwayNotification) outputs[2] = { ...output.armedAwayNotification, msgType: "armedAway" };
    if (output.triggeredNotification) outputs[3] = { ...output.triggeredNotification, msgType: "triggered" };
    if (output.armedHomeNotification) outputs[4] = { ...output.armedHomeNotification, msgType: "armedHome" };
    if (output.armedNightNotification) outputs[5] = { ...output.armedNightNotification, msgType: "armedNight" };
    if (output.armedVacationNotification) outputs[6] = { ...output.armedVacationNotification, msgType: "armedVacation" };
    if (output.armedCustomBypassNotification) outputs[7] = { ...output.armedCustomBypassNotification, msgType: "armedCustomBypass" };
    if (output.pendingNotification) outputs[8] = { ...output.pendingNotification, msgType: "pending" };
    if (output.unknownNotification) outputs[9] = { ...output.unknownNotification, msgType: "unknown" };
    if (output.armingNotification) outputs[10] = { ...output.armingNotification, msgType: "arming" };
    return outputs;
}

// --- Simple State Handler ---
function buildSimpleStateOutput(notificationKey, title, messageText, ttsText) {
    const messages = createMessageMultiTTS(messageText, title, ttsText);
    const output = { tts: messages.tts };
    output[notificationKey] = messages.notification;
    return buildOutputArray(output);
}

// --- Alarm State Handlers ---
function handleTriggeredState(msg, formattedTimePush, formattedTimeTTS) {
    const triggeredSensors = msg.data.event.new_state.attributes.open_sensors || {};
    const sensorMessages = [];
    const ttsMessages = [];
    Object.keys(triggeredSensors).forEach(sensor => {
        const location = sensorMappings[sensor] ?? "unknown location";
        if (sensor.includes('person_detected')) {
            ttsMessages.push(`The camera in the ${location} has detected a person.`);
            sensorMessages.push(`A person detected in the ${location}.`);
        } else {
            ttsMessages.push(`Someone has opened the ${location}.`);
            sensorMessages.push(`Someone has opened the ${location}.`);
        }
    });
    const messageText = `The alarm has been triggered by the following sensor(s): ${sensorMessages.join(', ')} ${formattedTimePush}`;
    const ttsMessageText = ttsMessages.join(', ') + (ttsMessages.length ? ` on ${formattedTimeTTS}` : '');
    const messages = createMessageMultiTTS(messageText, "ALARM TRIGGERED", ttsMessageText);
    return buildOutputArray({ tts: messages.tts, triggeredNotification: messages.notification });
}
function handleDisarmedState(msg, formattedTimePush, formattedTimeTTS) {
    const { changed_by } = msg.data.event.new_state.attributes;
    if (typeof changed_by === 'string' && knownUsers.includes(changed_by.toLowerCase())) {
        const disarmedMessage = `${changed_by} has disabled the alarm system on ${formattedTimePush}.`;
        const disarmedTTSMessage = `${changed_by} has disabled the alarm system.`;
        return buildSimpleStateOutput('disarmedNotification', 'Alarm Status', disarmedMessage, disarmedTTSMessage);
    }
    return null;
}
function handleArmedState(type, formattedTimePush, formattedTimeTTS) {
    const armedMessageText = `The alarm is now set to armed ${type} on ${formattedTimePush}.`;
    const armedTTSMessageText = `The alarm is now set to armed ${type}.`;
    let notificationKey;
    switch (type) {
        case 'home': notificationKey = 'armedHomeNotification'; break;
        case 'away': notificationKey = 'armedAwayNotification'; break;
        case 'night': notificationKey = 'armedNightNotification'; break;
        case 'vacation': notificationKey = 'armedVacationNotification'; break;
        case 'custom_bypass': notificationKey = 'armedCustomBypassNotification'; break;
        default: notificationKey = 'unknownNotification'; break;
    }
    return buildSimpleStateOutput(notificationKey, 'Alarm Status', armedMessageText, armedTTSMessageText);
}
function handlePendingState(formattedTimePush, formattedTimeTTS) {
    return buildSimpleStateOutput(
        'pendingNotification',
        'Alarm Status',
        `The Alarm is armed. Please deactivate. ${formattedTimePush}`,
        `Please be advised, The alarm is armed and will notify the police. Please disarm the alarm immediately.`
    );
}
function handleUnknownState(formattedTimePush, formattedTimeTTS) {
    return buildSimpleStateOutput(
        'unknownNotification',
        'Alarm Status',
        `The alarm state is unknown or unavailable on ${formattedTimePush}. Please check the system logs for more details.`,
        `The alarm state is unknown or unavailable.`
    );
}
function handleArmingState(formattedTimePush, formattedTimeTTS) {
    return buildSimpleStateOutput(
        'armingNotification',
        'Alarm Status',
        `The alarm is currently arming on ${formattedTimePush}.`,
        `The alarm is currently arming.`
    );
}

// --- State Routing ---
const stateHandlers = {
    'triggered': handleTriggeredState,
    'disarmed': handleDisarmedState,
    'armed_home': (msg, push, tts) => handleArmedState('home', push, tts),
    'armed_away': (msg, push, tts) => handleArmedState('away', push, tts),
    'armed_night': (msg, push, tts) => handleArmedState('night', push, tts),
    'armed_vacation': (msg, push, tts) => handleArmedState('vacation', push, tts),
    'armed_custom_bypass': (msg, push, tts) => handleArmedState('custom_bypass', push, tts),
    'pending': (msg, push, tts) => handlePendingState(push, tts),
    'unknown': (msg, push, tts) => handleUnknownState(push, tts),
    'unavailable': (msg, push, tts) => handleUnknownState(push, tts),
    'arming': (msg, push, tts) => handleArmingState(push, tts)
};

// --- Main Async Function ---
async function main(msg) {
    try {
        const currentTime = new Date();
        const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(currentTime);
        const { new_state: { state } } = msg.data.event;
        if (state in stateHandlers) {
            // Pass both formatted times to handlers that need them
            const outputs = stateHandlers[state](msg, formattedTimePush, formattedTimeTTS);
            // Add null check for outputs before proceeding
            if (!outputs) {
                node.warn(`State handler for '${state}' returned null. Skipping TTS processing.`);
                return null;
            }
            // If TTS (outputs[1]) is present and is an array, we need to send each element separately, respecting googleDelay
            if (outputs[1] && Array.isArray(outputs[1])) {
                // outputs[1][0]: Sonos, outputs[1][1]: Google volume, outputs[1][2]: Google TTS
                node.send([null, outputs[1][0], null, null, null, null, null, null, null, null, null]); // Sonos
                node.send([null, outputs[1][1], null, null, null, null, null, null, null, null, null]); // Google volume
                await delay(config.googleDelay);
                node.send([null, outputs[1][2], null, null, null, null, null, null, null, null, null]); // Google TTS
                // Remove tts from array, set to null to avoid sending as a batch
                outputs[1] = null;
            }
            return outputs;
        } else {
            node.warn(`Unhandled alarm state: ${state}. Please review the system.`);
            return null;
        }
    } catch (error) {
        const state = msg?.data?.event?.new_state?.state;
        await handleError(error, { state, msg });
        return null;
    }
}

return await main(msg);
