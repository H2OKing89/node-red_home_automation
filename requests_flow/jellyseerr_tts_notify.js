/**
 * Node-RED Function node: tts_notify.js
 * Generates Home Assistant TTS payloads for Sonos and Google speakers (multi-channel, async pattern).
 */
const statusMap = {
    "PENDING": "waiting for download.",
    "AVAILABLE": "ready to watch",
    "DOWNLOADING": "downloading",
    "UNKNOWN": "status unknown"
};

const TTS_EVENTS = [
    "MEDIA_AUTO_APPROVED",
    "MEDIA_APPROVED",
    "MEDIA_AVAILABLE",
    "MEDIA_PENDING"
];

const SONOS_SPEAKERS = [
    "media_player.sonos_1",
    "media_player.era_100",
    "media_player.bedroom_sonos_amp"
];
const GOOGLE_SPEAKERS = [
    "media_player.all_home_speaker"
];
const SONOS_VOLUME = 100;
const GOOGLE_VOLUME = 1.0;
const GOOGLE_DELAY = 400; // ms between volume and TTS for Google

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
    const payload = msg.payload || {};
    const eventType = payload.notification_type;
    node.debug('Incoming payload: ' + JSON.stringify(payload));

    let tts = null;
    if (eventType === "TEST_NOTIFICATION") {
        const subject = payload.subject || "Test Notification";
        const message = payload.message || "Test message received.";
        tts = `${subject}: ${message}`;
        node.log('TTS generated for TEST_NOTIFICATION');
    } else if (TTS_EVENTS.includes(eventType)) {
        const event = payload.event || "";
        const subject = payload.subject || "";
        const media_type = (payload.media && payload.media.media_type) || "";
        const status = (payload.media && payload.media.status) || "";
        const requestedBy_username = (payload.request && payload.request.requestedBy_username) || "";
        if (!event) node.warn('Missing event field');
        if (!subject) node.warn('Missing subject field');
        if (!requestedBy_username) node.warn('Missing requestedBy_username field');
        const friendlyStatus = statusMap[status] || status || "unknown";
        tts = `${event}: \"${subject}\" requested by ${requestedBy_username}. Status: ${friendlyStatus}.`;
        node.log(`TTS generated for event: ${eventType}`);
    }

    if (!tts) {
        node.warn('No TTS generated for this event');
        node.status({fill:"grey", shape:"ring", text:"No TTS for this event"});
        node.done();
        return;
    }

    node.debug('Generated TTS string: ' + tts);

    // Sonos payload
    const encodedMsg = encodeURIComponent(`"${tts}"`);
    const sonosPayload = {
        action: "media_player.play_media",
        target: { entity_id: SONOS_SPEAKERS },
        data: {
            media_content_id: `media-source://tts/google_translate?message=${encodedMsg}`,
            media_content_type: "music",
            announce: true,
            extra: { volume: SONOS_VOLUME }
        }
    };
    node.log('Sending Sonos TTS payload');
    node.send({ payload: sonosPayload });

    // Google volume payload
    const googleVolumePayload = {
        action: "media_player.volume_set",
        target: { entity_id: GOOGLE_SPEAKERS },
        data: { volume_level: GOOGLE_VOLUME }
    };
    node.log('Sending Google volume payload');
    node.send({ payload: googleVolumePayload });

    // Wait before sending Google TTS
    node.debug(`Waiting for ${GOOGLE_DELAY}ms before Google TTS`);
    await delay(GOOGLE_DELAY);

    // Google TTS payload
    const googleTtsPayload = {
        action: "tts.google_say",
        target: { entity_id: GOOGLE_SPEAKERS },
        data: {
            message: tts,
            cache: false
        }
    };
    node.log('Sending Google TTS payload');
    node.send({ payload: googleTtsPayload });

    node.status({fill:"blue", shape:"dot", text:"TTS payloads sent"});
    node.done();
})().catch(err => {
    node.error('TTS Notify Error: ' + err.message);
    node.done();
});

return null;