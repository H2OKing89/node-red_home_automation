/**
 * Script Name: Alarm handler with Multi-Speaker TTS
 * Platform: Node-RED
 * Flow: House Alarm
 * Group: Comprehensive Alarm Management, Notifications, and Emergency Handling
 * Date: 2024-09-02 (Updated 2025-10-05)
 * Version: 1.5.0
 * 1.5.0 change_log:
 * - Added multi-alarm support with alarm name extraction from friendly_name
 * - All notifications now include the specific alarm panel name
 * - Added getAlarmName() helper function with fallback parsing
 * - Updated all state handlers to include alarm name in messages
 * 1.4.0 change_log:
 * - Added node.status() updates for visual feedback
 * - Improved error handling with node.error(error, msg) for Catch node support
 * - Added node.done() for proper async completion tracking
 * - Added context storage for alarm state history tracking
 * - Added LOGGING_ENABLED flag for consistent logging
 * - Simplified logging approach to match other alarm scripts
 *
 * Adds support for Google Home/Nest speakers, alongside Sonos, for TTS announcements.
 *
 */

const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.5.0';

/**
 * Simple logging function
 * @param {string} message - Content to log
 * @param {string} level - Severity level (info, warn, error)
 */
function log(message, level = "info") {
    if (!LOGGING_ENABLED) return;
    if (level === "error") node.error(message);
    else if (level === "warn") node.warn(message);
    else node.log(message);
}

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
    log(warningMsg, 'warn');
    PUSHOVER_ENABLED = false;
}

// --- Delay Helper ---
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// --- Alarm Name Extractor ---
/**
 * Extracts the alarm name from the incoming message
 * @param {object} msg - The Node-RED message object
 * @returns {string} - The alarm panel name (e.g., "West Garage", "House Alarm")
 */
function getAlarmName(msg) {
    // Primary: Use friendly_name from attributes
    const friendlyName = msg.data?.event?.new_state?.attributes?.friendly_name;
    if (friendlyName) {
        log(`Extracted alarm name from friendly_name: ${friendlyName}`);
        return friendlyName;
    }
    
    // Fallback: Parse from entity_id
    const entityId = msg.data?.entity_id || msg.data?.event?.entity_id;
    if (entityId) {
        const parts = entityId.split('.');
        if (parts.length === 2 && parts[0] === 'alarm_control_panel') {
            // Convert "west_garage" to "West Garage"
            const parsedName = parts[1].split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            log(`Parsed alarm name from entity_id: ${parsedName}`);
            return parsedName;
        }
    }
    
    log('Could not extract alarm name, using default', 'warn');
    return 'Alarm'; // Default fallback
}

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
        if (response.status === 200) log('Pushover notification sent successfully.');
        else log(`Failed to send Pushover notification. Status code: ${response.status}`, 'error');
    } catch (error) {
        log(`Error sending Pushover notification: ${error.message}`, 'error');
    }
}

async function handleError(error, context, msg) {
    log(`Error: ${error.message}`, 'error');
    if (context) log(`Context: ${JSON.stringify(context)}`, 'error');
    await sendPushoverNotification(`Error: ${error.message}\nContext: ${JSON.stringify(context)}`);
    node.status({ fill: 'red', shape: 'ring', text: error.message });
    // Trigger catch node with proper error handling
    if (msg) node.error(error, msg);
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
log(`Loaded knownUsers from user-whitelist: ${JSON.stringify(knownUsers)}`);

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
log(`Loaded sensorMappings: ${JSON.stringify(sensorMappings)}`);

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
        log('date-fns-tz not available in global context. Returning ISO string.', 'warn');
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
function handleTriggeredState(msg, formattedTimePush, formattedTimeTTS, alarmName) {
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
    const messageText = `The ${alarmName} has been triggered by the following sensor(s): ${sensorMessages.join(', ')} ${formattedTimePush}`;
    const ttsMessageText = `The ${alarmName} has been triggered. ` + ttsMessages.join(', ') + (ttsMessages.length ? ` on ${formattedTimeTTS}` : '');
    const messages = createMessageMultiTTS(messageText, `${alarmName.toUpperCase()} TRIGGERED`, ttsMessageText);
    return buildOutputArray({ tts: messages.tts, triggeredNotification: messages.notification });
}
function handleDisarmedState(msg, formattedTimePush, formattedTimeTTS, alarmName) {
    const { changed_by } = msg.data.event.new_state.attributes;
    if (typeof changed_by === 'string' && knownUsers.includes(changed_by.toLowerCase())) {
        const disarmedMessage = `${changed_by} has disabled the ${alarmName} on ${formattedTimePush}.`;
        const disarmedTTSMessage = `${changed_by} has disabled the ${alarmName}.`;
        return buildSimpleStateOutput('disarmedNotification', `${alarmName} Status`, disarmedMessage, disarmedTTSMessage);
    }
    return null;
}
function handleArmedState(type, formattedTimePush, formattedTimeTTS, alarmName) {
    const armedMessageText = `The ${alarmName} is now set to armed ${type} on ${formattedTimePush}.`;
    const armedTTSMessageText = `The ${alarmName} is now set to armed ${type}.`;
    let notificationKey;
    switch (type) {
        case 'home': notificationKey = 'armedHomeNotification'; break;
        case 'away': notificationKey = 'armedAwayNotification'; break;
        case 'night': notificationKey = 'armedNightNotification'; break;
        case 'vacation': notificationKey = 'armedVacationNotification'; break;
        case 'custom_bypass': notificationKey = 'armedCustomBypassNotification'; break;
        default: notificationKey = 'unknownNotification'; break;
    }
    return buildSimpleStateOutput(notificationKey, `${alarmName} Status`, armedMessageText, armedTTSMessageText);
}
function handlePendingState(formattedTimePush, formattedTimeTTS, alarmName) {
    return buildSimpleStateOutput(
        'pendingNotification',
        `${alarmName} Status`,
        `The ${alarmName} is armed. Please deactivate. ${formattedTimePush}`,
        `Please be advised, The ${alarmName} is armed and will notify the police. Please disarm the alarm immediately.`
    );
}
function handleUnknownState(formattedTimePush, formattedTimeTTS, alarmName) {
    return buildSimpleStateOutput(
        'unknownNotification',
        `${alarmName} Status`,
        `The ${alarmName} state is unknown or unavailable on ${formattedTimePush}. Please check the system logs for more details.`,
        `The ${alarmName} state is unknown or unavailable.`
    );
}
function handleArmingState(formattedTimePush, formattedTimeTTS, alarmName) {
    return buildSimpleStateOutput(
        'armingNotification',
        `${alarmName} Status`,
        `The ${alarmName} is currently arming on ${formattedTimePush}.`,
        `The ${alarmName} is currently arming.`
    );
}

// --- State Routing ---
const stateHandlers = {
    'triggered': handleTriggeredState,
    'disarmed': handleDisarmedState,
    'armed_home': (msg, push, tts, alarmName) => handleArmedState('home', push, tts, alarmName),
    'armed_away': (msg, push, tts, alarmName) => handleArmedState('away', push, tts, alarmName),
    'armed_night': (msg, push, tts, alarmName) => handleArmedState('night', push, tts, alarmName),
    'armed_vacation': (msg, push, tts, alarmName) => handleArmedState('vacation', push, tts, alarmName),
    'armed_custom_bypass': (msg, push, tts, alarmName) => handleArmedState('custom_bypass', push, tts, alarmName),
    'pending': (msg, push, tts, alarmName) => handlePendingState(push, tts, alarmName),
    'unknown': (msg, push, tts, alarmName) => handleUnknownState(push, tts, alarmName),
    'unavailable': (msg, push, tts, alarmName) => handleUnknownState(push, tts, alarmName),
    'arming': (msg, push, tts, alarmName) => handleArmingState(push, tts, alarmName)
};

// --- Main Async Function ---
async function main(msg) {
    try {
        // Extract alarm name early
        const alarmName = getAlarmName(msg);
        
        // Update node status to show processing
        node.status({ fill: "yellow", shape: "dot", text: `Processing ${alarmName}...` });
        
        const currentTime = new Date();
        const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(currentTime);
        const { new_state: { state } } = msg.data.event;
        
        log(`Processing ${alarmName} state: ${state}`);
        
        if (state in stateHandlers) {
            // Pass alarm name to all handlers
            const outputs = stateHandlers[state](msg, formattedTimePush, formattedTimeTTS, alarmName);
            // Add null check for outputs before proceeding
            if (!outputs) {
                log(`State handler for '${state}' returned null. Skipping TTS processing.`, 'warn');
                node.status({ fill: "yellow", shape: "ring", text: `${alarmName} ${state} - no output` });
                node.done();
                return null;
            }
            
            // Update node status to show successful processing
            node.status({ fill: "green", shape: "dot", text: `${alarmName} ${state} processed` });
            
            // Track alarm state changes in context
            const stateHistory = context.get('alarm_state_history') || [];
            stateHistory.push({
                timestamp: currentTime.toISOString(),
                alarmName: alarmName,
                state: state,
                changed_by: msg.data.event.new_state?.attributes?.changed_by || 'unknown'
            });
            // Keep only last 50 state changes
            if (stateHistory.length > 50) stateHistory.shift();
            context.set('alarm_state_history', stateHistory);
            
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
            
            // Signal async completion
            node.done();
            return outputs;
        } else {
            log(`Unhandled ${alarmName} state: ${state}. Please review the system.`, 'warn');
            node.status({ fill: "yellow", shape: "ring", text: `${alarmName} unhandled: ${state}` });
            node.done();
            return null;
        }
    } catch (error) {
        const state = msg?.data?.event?.new_state?.state;
        const alarmName = getAlarmName(msg);
        await handleError(error, { alarmName, state, msg }, msg);
        node.done();
        return null;
    }
}

return await main(msg);
