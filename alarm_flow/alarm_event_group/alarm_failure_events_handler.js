// Name: Alarm Failure Events handler
// Description: Handles alarm failure events, formats messages, and sends TTS announcements.
// Author: Quentin King (updated)
// Date: 2023-07-01 (updated version)
// Version: 1.8.1
// Dependencies: Add date-fns and date-fns-tz in the function node setup tab
// See tts_sonos_google_examples.md for TTS payload format documentation

// --- Speaker Configuration ---
// Modify these arrays to add or remove speakers as needed
const SONOS_SPEAKERS = [
    "media_player.sonos_1",
    "media_player.bedroom_sonos_amp",
    "media_player.era_100"
];

const GOOGLE_SPEAKERS = [
    "media_player.house_google_speakers"
];

// --- TTS Configuration ---
const TTS_VOLUME = 100; // 0-100 for Sonos speakers
const TTS_CACHE = false; // Whether to cache TTS messages for Google speakers

// --- Mobile Notification Configuration ---
const MOBILE_DEVICES = {
    primary: "notify.mobile_app_quentin_s25u",
    others: [] // Add additional device services here if needed
};

// --- Message Configuration ---
const MESSAGE_OPTIONS = {
    includeTimeInTTS: false,  // Whether to include the full timestamp in TTS announcements
    includeTimeInPush: true   // Whether to include the full timestamp in push notifications
};

/*
   Changelog:
   - Version 1.8.1:
     - FIXED: Corrected date in header (2023 instead of 2025)
     - IMPROVED: Better concurrency handling with unique ID tracking
     - ENHANCED: Added node.done() calls at all return points for proper Node-RED completion tracking
     - IMPROVED: Proper handling of missing date information with clear fallbacks
   
   - Version 1.8.0:
     - ADDED: Configurable constants for speakers, mobile devices, and message formatting
     - IMPROVED: Consistent error handling with correct output array lengths
     - REFACTORED: Mobile notification creation using a helper function
     - ENHANCED: Support for flexible message formatting with/without timestamps
   
   - Version 1.7.0:
     - ADDED: Google TTS implementation using tts.google_say format
     - IMPROVED: Multi-platform TTS support for both Sonos and Google speakers
     - UPDATED: Return array now includes both Sonos and Google TTS messages
   
   - Version 1.6.0:
     - REPLACED: Moment.js with date-fns and date-fns-tz for improved date/time handling
     - IMPROVED: Direct use of Node-RED logging functions (node.log, node.warn, node.error, node.debug)
     - REMOVED: Custom logging system in favor of built-in Node-RED logging
     - ENHANCED: TTS payload formatting following best practices from documentation
*/

// --- Dependency Check for date-fns Libraries ---

/**
 * This function requires date-fns and date-fns-tz to be added in the Node-RED function node's setup tab.
 * 
 * To add these libraries:
 * 1. In Node-RED, double-click this function node
 * 2. Go to the "Setup" tab
 * 3. Add the following modules:
 *    - Module: date-fns | Variable: dateFns
 *    - Module: date-fns-tz | Variable: dateFnsTz
 */

// Check for required libraries
const dateFnsAvailable = typeof dateFns !== 'undefined';
const dateFnsTzAvailable = typeof dateFnsTz !== 'undefined';

// Log warning if dependencies are missing
if (!dateFnsAvailable) {
    node.error('REQUIRED MODULE MISSING: date-fns is not available. Add it in the function node setup tab.');
}
if (!dateFnsTzAvailable) {
    node.error('REQUIRED MODULE MISSING: date-fns-tz is not available. Add it in the function node setup tab.');
}

/**
 * Formats the date using date-fns-tz for timezone support.
 * @param {string|Date} date - The date to format.
 * @param {string} timeZone - The desired time zone (e.g., 'America/Chicago').
 * @returns {string} - The formatted date string.
 */
function formatDate(date, timeZone = 'America/Chicago') {
    if (!dateFnsAvailable || !dateFnsTzAvailable) {
        node.error('date-fns or date-fns-tz is not available. Date formatting will fail.');
        return "Date formatting unavailable";
    }
    
    try {
        // Primary formatting with timezone support
        if (dateFnsTzAvailable) {
            return dateFnsTz.formatInTimeZone(
                date, 
                timeZone, 
                "EEEE, MMMM d, yyyy 'at' HH:mm:ss zzz"
            );
        }
        
        // Fallback to date-fns without timezone if date-fns-tz is not available
        return dateFns.format(
            date,
            "EEEE, MMMM d, yyyy 'at' HH:mm:ss"
        );
    } catch (error) {
        node.error(`Date formatting error: ${error.message}`);
        return "Error formatting date";
    }
}

// --- No custom logging system needed anymore ---
// We'll use node.log, node.warn, node.error, and node.debug directly

// --- Helper Functions ---

/**
 * Validates the event payload structure.
 * @param {object} payload - The incoming payload from msg.
 * @throws Will throw an error if the payload structure is invalid.
 */
function validateEventPayload(payload) {
    if (!payload || payload.event_type !== 'alarmo_failed_to_arm') {
        throw new Error("Invalid payload structure - missing payload or incorrect event_type.");
    }
    if (!payload.event) {
        throw new Error("Invalid payload structure - missing event data.");
    }
}

/**
 * Cleans text by replacing newline characters with a space.
 * @param {string} text - The input text.
 * @returns {string} - The cleaned text.
 */
function cleanText(text) {
    return text ? text.replace(/\n/g, ' ') : '';
}

/**
 * Creates a notification payload for the specified mobile device.
 * @param {Object} msgObj - Base message object to extend
 * @param {Object} params - Notification parameters
 * @returns {Object} - Complete notification message object
 */
function createMobileNotification(msgObj, params) {
    const { message, title, data = {} } = params;
    return {
        ...msgObj,
        payload: {
            action: MOBILE_DEVICES.primary,
            data: {
                message,
                title,
                data
            }
        }
    };
}

// --- Sensor Message Formatting ---

// Mapping sensor types to their message formats.
const sensorTypeMessages = {
    door: (name) => `the ${name} is open`,
    window: (name) => `the ${name} is open`,
    motion: (name) => `motion was detected in the ${name}`,
    tamper: (name) => `the ${name} was tampered with`,
    default: (name) => `the ${name} is triggered`
};

/**
 * Formats sensor messages using a mapping for clarity.
 * Adds extra cleanup and logs unrecognized sensor types.
 * @param {Array} sensors - Array of sensor entity IDs.
 * @returns {string} - The formatted sensor message.
 */
function formatSensorMessages(sensors) {
    const sensorMessages = sensors.map(sensor => {
        // Ensure sensor is a string and trim any whitespace.
        let cleanedSensor = (sensor || '').toString().replace('binary_sensor.', '').replace(/_/g, ' ').trim();
        let matched = false;
        const types = Object.keys(sensorTypeMessages).filter(key => key !== 'default');
        for (const type of types) {
            if (cleanedSensor.toLowerCase().includes(type)) {
                matched = true;
                return sensorTypeMessages[type](cleanedSensor);
            }
        }
        if (!matched) {
            node.debug(`No specific formatting found for sensor: ${cleanedSensor}`);
        }
        return sensorTypeMessages['default'](cleanedSensor);
    });

    // Join sensor messages based on count.
    if (sensorMessages.length === 1) {
        return sensorMessages[0];
    } else if (sensorMessages.length === 2) {
        return `${sensorMessages[0]} and ${sensorMessages[1]}`;
    } else if (sensorMessages.length > 2) {
        return sensorMessages.slice(0, -1).join(', ') + `, and ${sensorMessages[sensorMessages.length - 1]}`;
    }
    return "one or more sensors are triggered";
}

/**
 * Handles errors by logging them and emitting them to be caught by a Catch node.
 * @param {Error} error - The error object.
 * @param {object} msg - The incoming message object.
 * @param {string} [contextId] - Optional context ID to clear from processing
 */
function handleError(error, msg, contextId) {
    const errorMsg = `Error: ${error.message}`;
    node.error(errorMsg, msg);
    
    // If contextId provided, clear it from processing
    if (contextId) {
        context.set(`processing_${contextId}`, false);
    }
}

// --- Configuration Objects ---

const reasonMessages = {
    'not_allowed': 'The action was not allowed because the alarm was already in the desired state.',
    'invalid_code': 'The action failed because an invalid code was entered.',
    'open_sensors': 'The action failed because the following sensors are open:',
    // Add more reasons as needed
};

const stateMappings = {
    'arm_home': { command: 'ARM_HOME', state: 'armed home' },
    'arm_away': { command: 'ARM_AWAY', state: 'armed away' },
    'arm_night': { command: 'ARM_NIGHT', state: 'armed night' },
    'arm_vacation': { command: 'ARM_VACATION', state: 'armed vacation' },
    'arm_custom_bypass': { command: 'ARM_CUSTOM_BYPASS', state: 'armed custom bypass' },
    'disarm': { command: 'DISARM', state: 'disarmed' }
};

// --- Main Logic ---
// This function now returns 4 outputs:
// 1. Sonos TTS message (media_player.play_media)
// 2. Google TTS message (tts.google_say)
// 3. Push notification message
// 4. Actionable notification (with or without actions based on event type)

try {
    node.debug('Function node initialized and running.');

    // --- Validate Incoming Message Object Early ---
    if (!msg || !msg.payload) {
        handleError(new Error("Missing msg or msg.payload."), msg, msg ? msg._msgid : 'unknown');
        node.done(); // Signal completion
        return [null, null, null, null]; // Match the 4 outputs in successful case
    }

    // --- Concurrency and Context Management ---
    const uniqueId = msg._msgid || (msg.payload.event && msg.payload.event.id) || 'default';
    if (context.get(`processing_${uniqueId}`)) {
        node.warn(`Event with ID ${uniqueId} is already being processed. Skipping duplicate processing.`);
        node.done(); // Signal completion
        return [null, null, null, null]; // Match the 4 outputs in successful case
    }
    context.set(`processing_${uniqueId}`, true);    // --- Destructuring and Early Payload Validation ---
    const { payload } = msg;
    node.debug(`Received payload structure: ${JSON.stringify(payload, null, 2)}`);
    
    const { event_type, event } = payload;
    try {
        validateEventPayload(payload);
    } catch (err) {
        node.error(`Payload validation failed: ${err.message}`);
        handleError(err, msg, uniqueId); // Use enhanced error handler with context ID
        node.done(); // Signal completion
        return [null, null, null, null]; // Match the 4 outputs in successful case
    }

    // --- Ensure Correct Data Types for Sensors ---
    let sensors = event.sensors;
    if (sensors && !Array.isArray(sensors)) {
        sensors = [sensors];
    }    // --- Granular Error Handling for Date Parsing using date-fns ---
    let eventDate;
    try {
        // Check for time_fired in payload first (new structure), then in event (old structure)
        let timeToUse = payload.time_fired || event.time_fired;
        if (!timeToUse) {
            node.warn("Missing time_fired in both payload and event. Using current time as fallback.");
            timeToUse = new Date().toISOString();
        } else {
            node.debug(`Using time_fired: ${timeToUse}`);
        }
        
        // Use date-fns to parse the date if available
        if (dateFnsAvailable) {
            // Check if it's an ISO string
            if (typeof timeToUse === 'string' && dateFns.isValid(dateFns.parseISO(timeToUse))) {
                eventDate = dateFns.parseISO(timeToUse);
            } else {
                // Fallback to regular Date constructor
                eventDate = new Date(timeToUse);
            }
        } else {
            eventDate = new Date(timeToUse);
        }
        
        // Validate the date using date-fns if available, otherwise use traditional method
        if (dateFnsAvailable) {
            if (!dateFns.isValid(eventDate)) {
                throw new Error("Invalid time_fired date format.");
            }
        } else if (isNaN(eventDate.getTime())) {
            throw new Error("Invalid time_fired date format.");
        }
    } catch (error) {
        handleError(error, msg, uniqueId); // Use enhanced error handler with context ID
        node.done(); // Signal completion
        return [null, null, null, null]; // Match the 4 outputs in successful case
    }
    node.debug(`Parsed Date Object: ${eventDate.toISOString()}`);

    const formattedDate = formatDate(eventDate, 'America/Chicago');
    node.debug(`Formatted Date: ${formattedDate}`);

    // --- Processing the Event ---
    let reasonMessage = '';

    if (event.reason) {
        if (reasonMessages[event.reason]) {
            reasonMessage = reasonMessages[event.reason];
            if (event.reason === 'open_sensors') {
                if (sensors && sensors.length > 0) {
                    const openSensors = formatSensorMessages(sensors);
                    reasonMessage = `${reasonMessages['open_sensors']} ${openSensors}.`;
                } else {
                    reasonMessage = 'The action failed because one or more sensors are open.';
                }
            }
        } else {
            reasonMessage = `The action failed for an unknown reason: ${event.reason}.`;
        }
    }
    if (!reasonMessage) {
        reasonMessage = 'The action failed due to an unspecified reason.';
    }

    let armState = event.command || '';
    let stateDetails = stateMappings[armState];
    if (!stateDetails) {
        handleError(new Error("Unrecognized arm state: " + armState), msg, uniqueId);
        node.done(); // Signal completion
        return [null, null, null, null]; // Match the 4 outputs in successful case
    }

    flow.set('command', stateDetails.command);
    payload.command = stateDetails.command;

    // Create messages with configurable time inclusion
    const timeComponent = MESSAGE_OPTIONS.includeTimeInPush ? ` on ${formattedDate}` : '';
    const ttsMsgTimeComponent = MESSAGE_OPTIONS.includeTimeInTTS ? ` on ${formattedDate}` : '';
    
    const messageText = `The alarm failed to ${stateDetails.state}${timeComponent}. ${reasonMessage}`;
    const ttsMessage = `The alarm failed to ${stateDetails.state}${ttsMsgTimeComponent}. ${reasonMessage}`;

    payload.notification_topic = `Alarm Failed to ${stateDetails.state}`;

    // --- Create Outgoing Messages ---
    // Clean TTS message once for all notifications
    const cleanTtsMessage = cleanText(ttsMessage);
    
    // Use the configured speaker groups from the top of the file
    const sonosSpeakers = SONOS_SPEAKERS;
    const googleSpeakers = GOOGLE_SPEAKERS;
    
    // Output 1: Multi-platform TTS - Sonos with media_player.play_media format
    // Use proper URL-encoding with quotes for Sonos
    const encodedTtsMessage = encodeURIComponent(`"${cleanTtsMessage}"`);
    
    // Create Sonos TTS message
    let msg1 = {
        ...msg,
        payload: {
            action: "media_player.play_media",
            target: {
                entity_id: sonosSpeakers
            },
            data: {
                media_content_id: `media-source://tts/google_translate?message=${encodedTtsMessage}`,
                media_content_type: "music",
                announce: true,
                extra: {
                    volume: TTS_VOLUME
                }
            }
        },
        // Add metadata to help identify message type in flow
        tts_type: "sonos",
        speakers: sonosSpeakers
    };
    
    // Create Google TTS message using tts.google_say format
    let msg1a = {
        ...msg,
        payload: {
            action: "tts.google_say",
            target: {
                entity_id: googleSpeakers
            },
            data: {
                message: cleanTtsMessage, // Plain text for Google (no encoding)
                cache: TTS_CACHE
            }
        },
        // Add metadata to help identify message type in flow
        tts_type: "google",
        speakers: googleSpeakers
    };

    // Output 2: Push Notification (unchanged)
    let msg2 = {
        ...msg,
        payload: {
            message: cleanText(messageText),
            notification_topic: payload.notification_topic
        }
    };    // Output 3: Actionable Notification - only for arm failures
    let msg3;
    // Only add actionable notification for arm failures (not disarm failures)
    if (stateDetails.command !== 'DISARM') {
        // For arm failures, create actionable notification with retry/force buttons
        msg3 = createMobileNotification(msg, {
            message: cleanText(messageText),
            title: payload.notification_topic,
            data: {
                priority: 'high',
                sticky: 'true',
                channel: 'alarm_stream',
                ttl: 0,
                color: '#FF0000',
                timeout: 600,
                tag: 'alarmo_armed_status',
                persistent: true,
                importance: 'high',
                notification_icon: 'mdi:alarm-light',
                actions: [
                    {
                        action: "ALARMO_RETRY_ARM",
                        title: "Retry Arm"
                    },
                    {
                        action: "ALARMO_FORCE_ARM",
                        title: "Force Arm"
                    }
                ]
            }
        });
    } else {
        // For disarm failures, use proper notification structure without action buttons
        msg3 = createMobileNotification(msg, {
            message: cleanText(messageText),
            title: payload.notification_topic,
            data: {
                priority: 'normal',
                sticky: 'false',
                channel: 'alarm_stream',
                ttl: 0,
                color: '#FFA500',
                timeout: 300,
                tag: 'alarmo_disarm_status',
                persistent: false,
                importance: 'default',
                notification_icon: 'mdi:alarm-off'
            }
        });
    }

    node.log(`Successfully processed alarm failure event with ID ${uniqueId}.`);

    context.set(`processing_${uniqueId}`, false);
    node.done(); // Signal completion to Node-RED runtime
    return [msg1, msg1a, msg2, msg3]; // Added msg1a (Google TTS)

} catch (error) {
    // Use the enhanced error handler with context ID
    const uniqueId = msg && msg._msgid ? msg._msgid : 'unknown';
    handleError(error, msg, uniqueId);
    node.done(); // Signal completion even on error
    return [null, null, null, null]; // Added null for Google TTS output
}
