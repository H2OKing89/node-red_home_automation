/**
 * Door State Notification Script (v1.0.6 - Async/Await + Destructuring + State Normalization)
 *
 * Description:
 *  - Processes the state of a door sensor and sends announcements for Sonos and Google devices.
 *  - Extracts and sanitizes the door name, normalizes sensor state.
 *  - Uses async/await for clear flow and central error handling.
 *
 * Author: Quentin
 * Date: 2024-08-21 (updated)
 */

// Configuration object defining target devices and behavior parameters
const config = {
    devices: {
        sonos: [ // List of Sonos media_player entities to announce on
            "media_player.sonos_1",
            "media_player.bedroom_sonos_amp",
            "media_player.era_100"
        ],
        google: [ // List of Google speaker entities for TTS
            "media_player.all_home_speaker"
        ]
    },
    volumes: { sonos: 100 },      // Sonos volume level (0-100)
    googleVolume: 1.0,            // Google speaker volume (0.0-1.0)
    googleDelay: 400              // Delay in ms before sending Google TTS payload
};

/**
 * Returns a Promise that resolves after given milliseconds,
 * used to throttle between requests.
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Constructs the payload for Sonos announcements.
 * Encodes the message text for URL-safe TTS parameters.
 */
function buildSonosPayload(messageText) {
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
 * Constructs the payload to set the volume on all Google devices.
 * Clamps the volume between 0.0 and 1.0 to prevent errors.
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
 * Constructs the payload for Google TTS announcements.
 */
function buildGoogleTtsPayload(messageText) {
    return {
        action: "tts.google_say",
        target: { entity_id: config.devices.google },
        data: { cache: false, message: messageText }
    };
}

// Immediately-invoked async function to process and send notifications
(async () => {
    try {
        // Log the incoming Node-RED msg object for debugging purposes
        node.debug(`Received message: ${JSON.stringify(msg)}`);

        // Destructure topic and payload from msg with defaults
        const { topic: rawId = 'sensor.unknown', payload: rawState = 'unknown' } = msg || {};
        node.debug(`Raw ID: ${rawId}, Raw State: ${rawState}`);

        // Extract the door name (e.g., sensor.front_door -> front door)
        const doorName = rawId.split('.')[1]?.replace(/_/g, ' ') || 'unknown door';

        // Normalize rawState to lowercase string for consistent comparisons
        const normalized = String(rawState).toLowerCase();
        const isOpen = (normalized === 'on' || normalized === 'true');
        node.debug(`Door: ${doorName}, Normalized state: ${normalized}, isOpen: ${isOpen}`);

        // Compose user-friendly announcement text
        const messageText = isOpen
            ? `The ${doorName} is open.`
            : normalized === 'off'
                ? `The ${doorName} is closed.`
                : `The ${doorName} has an unknown state.`;
        node.debug(`Message text: ${messageText}`);

        // Build and send the Sonos payload
        const sonosPayload = buildSonosPayload(messageText);
        node.debug(`Sonos payload: ${JSON.stringify(sonosPayload)}`);
        node.send({ payload: sonosPayload });

        // Build and send the Google volume payload
        const googleVolumePayload = buildGoogleVolumePayload();
        node.debug(`Google volume payload: ${JSON.stringify(googleVolumePayload)}`);
        node.send({ payload: googleVolumePayload });

        // Wait before sending the TTS payload to avoid overlapping commands
        node.debug(`Waiting for ${config.googleDelay}ms before Google TTS`);
        await delay(config.googleDelay);

        // Build and send the Google TTS payload
        const googleTtsPayload = buildGoogleTtsPayload(messageText);
        node.debug(`Google TTS payload: ${JSON.stringify(googleTtsPayload)}`);
        node.send({ payload: googleTtsPayload });
    } catch (error) {
        // Central error handler for any exceptions in the flow
        node.error(`Door Notification Error: ${error.message}`);
    }
})();

// Return null to indicate all messages have been sent asynchronously
return null;
