/**
 * Door State Notification Script (v1.2.0 - Production Ready with Enhanced Logging)
 *
 * Description:
 *  - Processes the state of a door sensor and sends announcements for Sonos and Google devices.
 *  - Extracts and sanitizes the door name, normalizes sensor state.
 *  - Uses async/await for clear flow and central error handling.
 *  - Updated to use new Home Assistant tts.speak API for Google speakers
 *
 * Changelog:
 * v1.2.0 (2025-10-05):
 *  - Added comprehensive JSDoc comments for all functions
 *  - Added setStatus() helper function for consistent status updates
 *  - Added log() wrapper with LOGGING_ENABLED flag for production control
 *  - Added node.status() updates throughout the flow for visual feedback
 *  - Enhanced defensive null checks and message validation
 *  - Added config validation on startup
 * v1.1.0 (2025-10-05):
 *  - Updated Google TTS to use new tts.speak action with tts.google_translate_en_com
 *  - Retained separate volume setting for Google speakers (still required)
 *  - Added node.done() for proper async completion tracking
 * v1.0.6 (2024-08-21):
 *  - Async/Await + Destructuring + State Normalization
 *
 * Author: Quentin
 * Date: 2024-08-21 (updated 2025-10-05)
 */

const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.2.0';

/**
 * Simple logging function with level control
 * @param {string} message - Content to log
 * @param {string} [level='info'] - Severity level (info, warn, error, debug)
 */
function log(message, level = "info") {
    if (!LOGGING_ENABLED && level !== "error") return;
    if (level === "error") node.error(message);
    else if (level === "warn") node.warn(message);
    else if (level === "debug") node.debug(message);
    else node.log(message);
}

/**
 * Updates the node status badge with consistent formatting
 * @param {string} fill - Color: 'yellow' (processing), 'green' (success), 'red' (error), 'blue' (info)
 * @param {string} text - Status text to display
 * @param {string} [shape='dot'] - Shape: 'dot', 'ring'
 */
function setStatus(fill, text, shape = 'dot') {
    node.status({ fill, shape, text });
}

// Configuration object defining target devices and behavior parameters
const config = {
    devices: {
        sonos: [ // List of Sonos media_player entities to announce on
            "media_player.sonos_1",
            "media_player.bedroom_sonos_amp",
            "media_player.living_room_sonos_era_100"
        ],
        google: [ // List of Google speaker entities for TTS
            "media_player.basement_bedroom_hub2",
            "media_player.family_room_home_mini",
            "media_player.kitchen_home_mini",
            "media_player.garage_home_mini"
        ]
    },
    volumes: { sonos: 100 },      // Sonos volume level (0-100)
    googleVolume: 1.0,            // Google speaker volume (0.0-1.0)
    googleTtsEntity: "tts.google_translate_en_com", // Google TTS service entity
    googleDelay: 400              // Delay in ms before sending Google TTS payload
};

// Validate configuration on startup
if (!config.devices.sonos.length && !config.devices.google.length) {
    log('No speaker devices configured', 'warn');
}
if (!config.googleTtsEntity) {
    log('Google TTS entity not configured', 'warn');
}

/**
 * Returns a Promise that resolves after given milliseconds
 * Used to throttle between requests to avoid command conflicts
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Constructs the payload for Sonos announcements
 * Encodes the message text for URL-safe TTS parameters
 * @param {string} messageText - The text message to announce
 * @returns {object} Home Assistant service call payload for Sonos
 */
function buildSonosPayload(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        log('Invalid message text for Sonos payload', 'warn');
        return null;
    }
    const encoded = encodeURIComponent(`"${messageText}"`); // wrap text in quotes
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

/**
 * Constructs the payload to set the volume on all Google devices
 * Clamps the volume between 0.0 and 1.0 to prevent errors
 * @returns {object} Home Assistant service call payload for volume control
 */
function buildGoogleVolumePayload() {
    const level = Math.min(Math.max(config.googleVolume, 0), 1);
    return {
        action: "media_player.volume_set",
        target: { entity_id: config.devices.google },
        data: { volume_level: level }
    };
}

/**
 * Constructs the payload for Google TTS announcements using new Home Assistant API
 * Uses tts.speak action with tts.google_translate_en_com entity
 * @param {string} messageText - The text message to speak
 * @returns {object} Home Assistant service call payload for Google TTS
 */
function buildGoogleTtsPayload(messageText) {
    if (!messageText || typeof messageText !== 'string') {
        log('Invalid message text for Google TTS payload', 'warn');
        return null;
    }
    return {
        action: "tts.speak",
        target: { entity_id: config.googleTtsEntity },
        data: {
            cache: true,
            media_player_entity_id: config.devices.google,
            message: messageText
        }
    };
}

// Immediately-invoked async function to process and send notifications
(async () => {
    try {
        // Validate message structure
        if (!msg || typeof msg !== 'object') {
            log('Invalid message received', 'error');
            setStatus('red', 'Invalid message', 'ring');
            return;
        }

        setStatus('yellow', 'Processing...');
        
        // Log the incoming Node-RED msg object for debugging purposes
        log(`Received message: ${JSON.stringify(msg)}`, 'debug');

        // Destructure topic and payload from msg with defaults
        const { topic: rawId = 'sensor.unknown', payload: rawState = 'unknown' } = msg;
        log(`Raw ID: ${rawId}, Raw State: ${rawState}`, 'debug');

        // Extract the door name (e.g., sensor.front_door -> front door)
        const doorName = rawId.split('.')[1]?.replace(/_/g, ' ') || 'unknown door';

        // Normalize rawState to lowercase string for consistent comparisons
        const normalized = String(rawState).toLowerCase();
        const isOpen = (normalized === 'on' || normalized === 'true');
        log(`Door: ${doorName}, Normalized state: ${normalized}, isOpen: ${isOpen}`, 'debug');

        // Compose user-friendly announcement text
        const messageText = isOpen
            ? `The ${doorName} is open.`
            : normalized === 'off'
                ? `The ${doorName} is closed.`
                : `The ${doorName} has an unknown state.`;
        log(`Message text: ${messageText}`);

        setStatus('yellow', 'Sending Sonos...');
        
        // Build and send the Sonos payload
        const sonosPayload = buildSonosPayload(messageText);
        if (sonosPayload) {
            log(`Sonos payload: ${JSON.stringify(sonosPayload)}`, 'debug');
            node.send({ payload: sonosPayload });
        } else {
            log('Skipping Sonos - invalid payload', 'warn');
        }

        setStatus('yellow', 'Setting volume...');
        
        // Build and send the Google volume payload
        const googleVolumePayload = buildGoogleVolumePayload();
        log(`Google volume payload: ${JSON.stringify(googleVolumePayload)}`, 'debug');
        node.send({ payload: googleVolumePayload });

        // Wait before sending the Google TTS payload to avoid overlapping commands
        log(`Waiting for ${config.googleDelay}ms before Google TTS`, 'debug');
        await delay(config.googleDelay);

        setStatus('yellow', 'Sending Google TTS...');
        
        // Build and send the Google TTS payload (new API format)
        const googleTtsPayload = buildGoogleTtsPayload(messageText);
        if (googleTtsPayload) {
            log(`Google TTS payload: ${JSON.stringify(googleTtsPayload)}`, 'debug');
            node.send({ payload: googleTtsPayload });
        } else {
            log('Skipping Google TTS - invalid payload', 'warn');
        }

        setStatus('green', `Sent: ${doorName}`);
        log(`Successfully processed ${doorName} notification`);
    } catch (error) {
        // Central error handler for any exceptions in the flow
        const errorMsg = error?.message || 'Unknown error';
        log(`Door Notification Error: ${errorMsg}`, 'error');
        setStatus('red', errorMsg, 'ring');
        node.error(error, msg);
    } finally {
        // Signal async completion (NR >= 1.0)
        node.done();
    }
})();

// Return null to indicate all messages have been sent asynchronously
return null;
