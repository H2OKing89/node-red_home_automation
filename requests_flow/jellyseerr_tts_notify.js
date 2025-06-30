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
    "MEDIA_PENDING",
    "ISSUE_CREATED",
    "ISSUE_COMMENT",
    "ISSUE_REOPENED",
    "ISSUE_RESOLVED"

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
    } else if (eventType === "ISSUE_CREATED") {
        const event = payload.event || "Issue Created";
        const subject = payload.subject || "Unknown Subject";
        const issue = payload.issue || {};
        const reportedBy_username = issue.reportedBy_username || "Unknown User";
        tts = `${event}: \"${subject}\" reported by ${reportedBy_username}.`;
        node.log('TTS generated for ISSUE_CREATED');
    } else if (eventType === "ISSUE_COMMENT") {
        const event = payload.event || "Issue Commented";
        const subject = payload.subject || "Unknown Subject";
        const comment = payload.comment || {};
        const comment_message = comment.comment_message || "No comment provided.";
        const commentedBy_username = comment.commentedBy_username || "Unknown User";
        const issue = payload.issue || {};
        // Suppress comment TTS only if status is RESOLVED (handled by status change event)
        if (issue.issue_status === "RESOLVED") {
            node.log('Suppressing duplicate TTS for ISSUE_COMMENT after RESOLVED');
            tts = null;
        } else {
            tts = `${event}: \"${subject}\". ${commentedBy_username} commented: ${comment_message}`;
            node.log('TTS generated for ISSUE_COMMENT');
        }
    } else if (eventType === "ISSUE_RESOLVED") {
        const event = payload.event || "Issue Resolved";
        const subject = payload.subject || "Unknown Subject";
        const issue = payload.issue || {};
        const reportedBy_username = issue.reportedBy_username || "Unknown User";
        const comment = payload.comment;
        if (comment && comment.comment_message) {
            const comment_message = comment.comment_message || "";
            const commentedBy_username = comment.commentedBy_username || "Unknown User";
            tts = `${event}: \"${subject}\" reported by ${reportedBy_username} has been resolved. ${commentedBy_username} commented: ${comment_message}`;
        } else {
            tts = `${event}: \"${subject}\" reported by ${reportedBy_username} has been resolved.`;
        }
        node.log('TTS generated for ISSUE_RESOLVED');
    } else if (eventType === "ISSUE_REOPENED") {
        const event = payload.event || "Issue Reopened";
        const subject = payload.subject || "Unknown Subject";
        const issue = payload.issue || {};
        const reportedBy_username = issue.reportedBy_username || "Unknown User";
        const comment = payload.comment;
        if (comment && comment.comment_message) {
            const comment_message = comment.comment_message || "";
            const commentedBy_username = comment.commentedBy_username || "Unknown User";
            tts = `${event}: \"${subject}\" reported by ${reportedBy_username} has been reopened. ${commentedBy_username} commented: ${comment_message}`;
        } else {
            tts = `${event}: \"${subject}\" reported by ${reportedBy_username} has been reopened.`;
        }
        node.log('TTS generated for ISSUE_REOPENED');
    } else if (TTS_EVENTS.includes(eventType)) {
        const event = payload.event || "";
        const subject = payload.subject || "";
        const media_type = (payload.media && payload.media.media_type) || "";
        const status = (payload.media && payload.media.status) || "";
        const requestedBy_username = (payload.request && payload.request.requestedBy_username) || "";
        if (!event) node.warn('Missing event field');
        if (!subject) node.warn('Missing subject field');
        // Only warn for requestedBy_username if the event is not an issue event
        if (!requestedBy_username && !eventType.startsWith('ISSUE_')) node.warn('Missing requestedBy_username field');
        const friendlyStatus = statusMap[status] || status || "unknown";
        tts = `${event}: \"${subject}\" requested by ${requestedBy_username}. Status: ${friendlyStatus}.`;
        node.log(`TTS generated for event: ${eventType}`);
    }

    if (!tts) {
        node.warn(`No TTS generated for this event: ${eventType}`);
        node.status({ fill: "grey", shape: "ring", text: "No TTS for this event" });
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

    node.status({ fill: "blue", shape: "dot", text: "TTS payloads sent" });
    node.done();
})().catch(err => {
    node.error('TTS Notify Error: ' + err.message);
    node.done();
});

return null;