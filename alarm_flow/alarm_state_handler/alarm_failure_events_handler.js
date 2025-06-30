// Name: Alarm Failure Events handler
// Description: Handles alarm failure events, formats messages, and sends TTS announcements.
// Author: Quentin King (updated)
// Date: 2025-06-19 (updated version)
// Version: 1.5.0


/*
   Changelog:
   - Version 1.5.0:
     - REMOVED: Complete retry mechanism and all retry-related configuration (maxRetries, initialDelay, backoffFactor, etc.)
     - ADDED: Enhanced actionable notifications for arm failure events with "Retry Arm" and "Force Arm" action buttons
     - IMPROVED: Conditional actionable notifications - only arm failures get action buttons, disarm failures get simple notifications
     - ENHANCED: High priority, sticky notifications with alarm-specific channel and visual styling for arm failures
     - STREAMLINED: Code structure by removing retry complexity while maintaining core functionality
   
   - Version 1.4.2-SonosTTS:
     - Modified date handling: if event.time_fired is missing, check payload.time_fired before falling back to current time.
     - Updated TTS output to use the new Sonos announcement payload format.
     - Other robust dependency and error-handling enhancements from version 1.4.1.
*/

// --- Dependency Check and Fallbacks ---

const moment = global.get('moment'); // Check if Moment.js is loaded.
if (!moment) {
    // If Moment.js isn't available, log an error and create a fallback date formatter.
    // Note: This fallback uses the built-in Date.toLocaleString(), which may not support time zones.
    // In production, you might want to load an alternative lightweight library.
    logMessage('ERROR', 'Moment.js is not available. Date formatting will use a basic fallback.');
    var momentAvailable = false;
} else {
    var momentAvailable = true;
}

/**
 * Formats the date using Moment.js (if available) or falls back to a basic formatter.
 * @param {string|Date} date - The date to format.
 * @param {string} timeZone - The desired time zone (e.g., 'America/Chicago').
 * @returns {string} - The formatted date string.
 */
function formatDate(date, timeZone = 'America/Chicago') {
    if (momentAvailable) {
        try {
            return moment.tz(date, timeZone).format('dddd, MMMM D, YYYY [at] HH:mm:ss z');
        } catch (error) {
            logMessage('ERROR', `Error using Moment.js to format date: ${error.message}`);
            // Fallback formatting in case of error
        }
    }
    // Basic fallback formatting
    try {
        return new Date(date).toLocaleString();
    } catch (error) {
        logMessage('ERROR', `Fallback date formatting error: ${error.message}`);
        return "Unknown Date";
    }
}

// --- Logging Enhancements ---

// Mapping log levels to Node-RED logging functions.
const logLevelMapping = {
    DEBUG: node.log,
    INFO: node.log,
    WARN: node.warn,
    ERROR: node.error
};

/**
 * Logs messages using different Node-RED logging functions based on severity.
 * @param {string} level - The log level ('DEBUG', 'INFO', 'WARN', 'ERROR').
 * @param {string} message - The message content.
 */
function logMessage(level, message) {
    const debugging = context.get('debugging') !== undefined ? context.get('debugging') : true; // Default to true if not set.
    if (debugging) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        if (logLevelMapping[level]) {
            logLevelMapping[level](logEntry);
        } else {
            node.log(logEntry);
        }
    }
}

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
            logMessage('DEBUG', `No specific formatting found for sensor: ${cleanedSensor}`);
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
 */
function handleError(error, msg) {
    const errorMsg = `Error: ${error.message}`;
    logMessage('ERROR', errorMsg);
    node.error(errorMsg, msg);
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

try {
    logMessage('DEBUG', 'Function node initialized and running.');

    // --- Validate Incoming Message Object Early ---
    if (!msg || !msg.payload) {
        handleError(new Error("Missing msg or msg.payload."), msg);
        return [null, null, null];
    }

    // --- Concurrency and Context Management ---
    const uniqueId = msg._msgid || (msg.payload.event && msg.payload.event.id) || 'default';
    if (context.get(`processing_${uniqueId}`)) {
        logMessage('WARN', `Event with ID ${uniqueId} is already being processed. Skipping duplicate processing.`);
        return [null, null, null];
    }
    context.set(`processing_${uniqueId}`, true);    // --- Destructuring and Early Payload Validation ---
    const { payload } = msg;
    logMessage('DEBUG', `Received payload structure: ${JSON.stringify(payload, null, 2)}`);
    
    const { event_type, event } = payload;
    try {
        validateEventPayload(payload);
    } catch (err) {
        logMessage('ERROR', `Payload validation failed: ${err.message}`);
        handleError(err, msg);
        context.set(`processing_${uniqueId}`, false); // Clear lock on error.
        return [null, null, null];
    }

    // --- Ensure Correct Data Types for Sensors ---
    let sensors = event.sensors;
    if (sensors && !Array.isArray(sensors)) {
        sensors = [sensors];
    }    // --- Granular Error Handling for Date Parsing ---
    let eventDate;
    try {
        // Check for time_fired in payload first (new structure), then in event (old structure)
        let timeToUse = payload.time_fired || event.time_fired;
        if (!timeToUse) {
            logMessage('WARN', "Missing time_fired in both payload and event. Using current time as fallback.");
            timeToUse = new Date().toISOString();
        } else {
            logMessage('DEBUG', `Using time_fired: ${timeToUse}`);
        }
        eventDate = new Date(timeToUse);
        if (isNaN(eventDate.getTime())) {
            throw new Error("Invalid time_fired date format.");
        }
    } catch (error) {
        handleError(error, msg);
        context.set(`processing_${uniqueId}`, false);
        return [null, null, null];
    }
    logMessage('DEBUG', `Parsed Date Object: ${eventDate.toISOString()}`);

    const formattedDate = formatDate(eventDate, 'America/Chicago');
    logMessage('DEBUG', `Formatted Date: ${formattedDate}`);

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
        handleError(new Error("Unrecognized arm state: " + armState), msg);
        context.set(`processing_${uniqueId}`, false);
        return [null, null, null];
    }

    flow.set('command', stateDetails.command);
    payload.command = stateDetails.command;

    const messageText = `The alarm failed to ${stateDetails.state} on ${formattedDate}. ${reasonMessage}`;
    const ttsMessage = `The alarm failed to ${stateDetails.state}. ${reasonMessage}`;

    payload.notification_topic = `Alarm Failed to ${stateDetails.state}`;

    // --- Create Outgoing Messages ---
    // Output 1: TTS (Now using Sonos Announcement)
    let msg1 = {
        ...msg,
        payload: {
            action: "media_player.play_media",
            target: {
                entity_id: [
                    "media_player.sonos_1",
                    "media_player.bedroom_sonos_amp",
                    "media_player.era_100"
                ]
            },
            data: {
                media_content_id: 'media-source://tts/google_translate?message=' + encodeURIComponent('"' + cleanText(ttsMessage) + '"'),
                media_content_type: "music",
                announce: true,
                extra: {
                    volume: 100
                }
            }
        }    };

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
        msg3 = {
            ...msg,
            payload: {
                action: "notify.mobile_app_quentin_s25u", // Explicit Home Assistant service
                data: {
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
                },
            }
        };    } else {
        // For disarm failures, use proper notification structure without action buttons
        msg3 = {
            ...msg,
            payload: {
                action: "notify.mobile_app_quentin_s25u", // Explicit Home Assistant service
                data: {
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
                },
            }
        };
    }

    logMessage('INFO', `Successfully processed alarm failure event with ID ${uniqueId}.`);

    context.set(`processing_${uniqueId}`, false);
    return [msg1, msg2, msg3];

} catch (error) {
    handleError(error, msg);
    if (msg && msg._msgid) {
        context.set(`processing_${msg._msgid}`, false);
    }
    return [null, null, null];
}
