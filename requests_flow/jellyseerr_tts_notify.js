/**
 * Script Name: Jellyseerr TTS Notification Handler
 * Version: 2.1.0
 * Date: 2025-10-09
 * 
 * Description:
 * Generates Home Assistant TTS payloads for Sonos and Google speakers based on Jellyseerr webhook events.
 * Supports multi-channel audio delivery with device-specific volume control and timing adjustments.
 * 
 * Changelog:
 * - 2.1.0: Updated Google TTS to use new tts.speak API (2025+ standard) instead of deprecated tts.google_say,
 *          changed cache to true for better performance, moved media_player to data.media_player_entity_id
 * - 2.0.0: Enhanced error handling with msg passing to Catch nodes, added comprehensive status updates,
 *          implemented proper async/finally pattern with guaranteed node.done() execution,
 *          improved code organization with clear sections
 * - 1.0.0: Initial implementation with basic TTS generation and multi-speaker support
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

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
    "media_player.living_room_sonos_era_100",
    "media_player.bedroom_sonos_amp"
];

const GOOGLE_SPEAKERS = [
    "media_player.basement_bedroom_hub2",
    "media_player.family_room_home_mini",
    "media_player.kitchen_home_mini",
    "media_player.garage_home_mini" 
];

const GOOGLE_TTS_SERVICE = "tts.google_translate_en_com"; // TTS service entity for new API

const SONOS_VOLUME = 100;
const GOOGLE_VOLUME = 1.0;
const GOOGLE_DELAY = 400; // ms between volume and TTS for Google

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Async delay function for timing control between TTS commands
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Resolves after specified delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// TTS GENERATION LOGIC
// ============================================================================

/**
 * Generate TTS message based on event type and payload data
 * @param {object} payload - Jellyseerr webhook payload
 * @param {string} eventType - Type of notification event
 * @returns {string|null} Generated TTS message or null if not applicable
 */
function generateTTS(payload, eventType) {
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
        
        // Validation warnings
        if (!event) node.warn('Missing event field');
        if (!subject) node.warn('Missing subject field');
        if (!requestedBy_username && !eventType.startsWith('ISSUE_')) {
            node.warn('Missing requestedBy_username field');
        }
        
        const friendlyStatus = statusMap[status] || status || "unknown";
        tts = `${event}: \"${subject}\" requested by ${requestedBy_username}. Status: ${friendlyStatus}.`;
        node.log(`TTS generated for event: ${eventType}`);
    }
    
    return tts;
}

// ============================================================================
// PAYLOAD BUILDERS
// ============================================================================

/**
 * Build Sonos TTS payload
 * @param {string} ttsMessage - TTS message to announce
 * @returns {object} Home Assistant service call payload for Sonos
 */
function buildSonosPayload(ttsMessage) {
    const encodedMsg = encodeURIComponent(`"${ttsMessage}"`);
    return {
        action: "media_player.play_media",
        target: { entity_id: SONOS_SPEAKERS },
        data: {
            media_content_id: `media-source://tts/google_translate?message=${encodedMsg}`,
            media_content_type: "music",
            announce: true,
            extra: { volume: SONOS_VOLUME }
        }
    };
}

/**
 * Build Google volume control payload
 * @returns {object} Home Assistant service call payload for volume
 */
function buildGoogleVolumePayload() {
    return {
        action: "media_player.volume_set",
        target: { entity_id: GOOGLE_SPEAKERS },
        data: { volume_level: GOOGLE_VOLUME }
    };
}

/**
 * Build Google TTS payload using new tts.speak API (2025+)
 * @param {string} ttsMessage - TTS message to announce
 * @returns {object} Home Assistant service call payload for Google TTS
 */
function buildGoogleTTSPayload(ttsMessage) {
    return {
        action: "tts.speak",
        target: { entity_id: GOOGLE_TTS_SERVICE },
        data: {
            cache: true,
            media_player_entity_id: GOOGLE_SPEAKERS,
            message: ttsMessage
        }
    };
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

(async () => {
    try {
        // Set initial processing status
        node.status({ fill: "blue", shape: "ring", text: "Processing..." });
        
        const payload = msg.payload || {};
        const eventType = payload.notification_type;
        node.debug('Incoming payload: ' + JSON.stringify(payload));
        
        // Generate TTS message
        node.status({ fill: "blue", shape: "dot", text: "Generating TTS..." });
        const tts = generateTTS(payload, eventType);
        
        // Handle case where no TTS should be generated
        if (!tts) {
            node.warn(`No TTS generated for this event: ${eventType}`);
            node.status({ fill: "grey", shape: "ring", text: "No TTS for this event" });
            return;
        }
        
        node.debug('Generated TTS string: ' + tts);
        
        // Send Sonos TTS payload
        node.status({ fill: "blue", shape: "dot", text: "Sending Sonos TTS..." });
        const sonosPayload = buildSonosPayload(tts);
        node.log('Sending Sonos TTS payload');
        node.send({ payload: sonosPayload });
        
        // Send Google volume adjustment
        node.status({ fill: "blue", shape: "dot", text: "Setting Google volume..." });
        const googleVolumePayload = buildGoogleVolumePayload();
        node.log('Sending Google volume payload');
        node.send({ payload: googleVolumePayload });
        
        // Wait for Google speaker to adjust volume before TTS
        node.debug(`Waiting ${GOOGLE_DELAY}ms before Google TTS`);
        await delay(GOOGLE_DELAY);
        
        // Send Google TTS payload
        node.status({ fill: "blue", shape: "dot", text: "Sending Google TTS..." });
        const googleTtsPayload = buildGoogleTTSPayload(tts);
        node.log('Sending Google TTS payload');
        node.send({ payload: googleTtsPayload });
        
        // Success status
        node.status({ fill: "green", shape: "dot", text: "TTS sent successfully" });
        
    } catch (err) {
        // Enhanced error handling - pass msg to route to Catch nodes
        node.error(`TTS Notify Error: ${err.message}`, msg);
        node.status({ fill: "red", shape: "dot", text: `Error: ${err.message}` });
    } finally {
        // Guaranteed completion signal for Node-RED runtime
        node.done();
    }
})();

return;