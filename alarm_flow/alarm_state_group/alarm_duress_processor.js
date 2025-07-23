/****************************************************
 * Script Name: Duress Alarm Code Alert Generator
 * Author: Quentin King
 * Version: 1.6.11
 ****************************************************/

// Toggle all logging on or off
const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.6.11';
// Unique ID per execution for traceability
const executionId = `${Date.now()}-${Math.random().toString(36).slice(2,11)}`;

// Import date-fns-tz for robust time zone and DST handling
const TIME_ZONE = 'America/Chicago';

// Standard format strings per documentation
const FORMATS = {
    push: "MMMM do, yyyy h:mm a zzz",
    tts: "MMMM do, yyyy 'at' h:mm a zzz",
    iso: "yyyy-MM-dd HH:mm:ss"
};

// Error handling for missing libraries per documentation standards
if (!dateFnsTz?.formatInTimeZone) {
    node.error('[alarm_duress_processor] date-fns-tz not available in global context');
    return null;
}
const { formatInTimeZone } = dateFnsTz;

// Standard function per documentation
function getFormattedTimes(date = new Date()) {
    if (!dateFnsTz?.formatInTimeZone) {
        node.warn('[alarm_duress_processor] date-fns-tz not available. Using fallback.');
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
    
    try {
        return {
            formattedTimePush: formatInTimeZone(date, TIME_ZONE, FORMATS.push),
            formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, FORMATS.tts)
        };
    } catch (error) {
        node.error(`[alarm_duress_processor] Error formatting date: ${error.message}`);
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
}

// Simple logging: enable/disable only
function log(message, level = "info") {
    if (!LOGGING_ENABLED) return;
    if (level === "error") node.error(message);
    else if (level === "warn") node.warn(message);
    else node.log(message);
}

// Initial debug log when the script starts
log(`[Debug] Script start: executionId=${executionId}`);

// Ensure msg object exists for Node-RED context
msg = msg || {};

/**
 * Build the duress alert message from JSON fields.
 * @param {Object} obj - Duress message object.
 * @param {string} ts - Timestamp string.
 * @returns {string}
 */
function buildDuressMessage(obj, ts) {
    return `${obj.intro}\n\n${obj.law_enforcement}\n${obj.name}: ${obj.address}, ${obj.city}, ${obj.state}\nPhone: ${obj.phone}\n\n${obj.scene_msg} ${obj.passphrase}\n\n${ts}`;
}

/**
 * Build a Discord embed payload for alerts.
 * @param {Object} obj - Duress message object.
 * @param {string} ts - Timestamp string.
 * @param {string} duressMsgDiscord - The formatted Discord message.
 * @param {Date} now - The timestamp to use for all outputs.
 * @returns {Object}
 */
function buildDiscordEmbed(obj, ts, duressMsgDiscord, now) {
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    return {
        action: "create",
        embeds: [{
            title: `[DURESS] Alarm System Alert - ${month} ${year}`,
            description: duressMsgDiscord,
            color: 16711680,
            footer: {
                text: `<Version ${SCRIPT_VERSION}> By, Quentin King`
            },
            image: {
                url: "https://ptpimg.me/4kt5j5.gif"
            },
            timestamp: now.toISOString()
        }]
    };
}

// Main async IIFE to build and return the alert message
return (async () => {
    const now = new Date();
    const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(now);
    try {
        log('[Debug] Async function start');
        // Use standard format for timestamp
        const ts = formattedTimePush;
        log(`[Debug] Timestamp=${ts}`);

        // Retrieve duress message from environment
        let duressMsgRaw = env.get("DURESS_MESSAGE");
        let duressMsg, duressMsgDiscord, duressObj;
        if (typeof duressMsgRaw === 'object' && duressMsgRaw !== null) {
            duressObj = duressMsgRaw;
            duressMsg = buildDuressMessage(duressObj, ts);
            duressMsgDiscord = `@everyone ${duressMsg}`;
        } else {
            try {
                duressObj = JSON.parse(duressMsgRaw);
                duressMsg = buildDuressMessage(duressObj, ts);
                duressMsgDiscord = `@everyone ${duressMsg}`;
            } catch (e) {
                duressMsg = (duressMsgRaw || "DURESS Alarm Code entered. Send help!!") + ' ' + ts;
                duressMsgDiscord = `@everyone ${duressMsg}`;
                duressObj = null;
            }
        }

        // Get Discord targets from env
        let discordIdRaw = env.get("DURESS_DISCORD_ID");
        let discordTargets = [];
        try {
            const discordObj = typeof discordIdRaw === 'object' ? discordIdRaw : JSON.parse(discordIdRaw);
            if (discordObj && Array.isArray(discordObj.duress_discord_id)) {
                discordTargets = discordObj.duress_discord_id;
            }
        } catch (e) {
            log('Could not parse DURESS_DISCORD_ID', 'error');
        }

        // Build Discord outputs for all channels and users
        // Each output is a message for a channel or user, as required by the Discord node
        const discordOutputs = [];
        if (duressObj && discordTargets.length > 0) {
            const embedPayload = buildDiscordEmbed(duressObj, ts, duressMsgDiscord, now);
            discordTargets.forEach(entry => {
                if (entry.channel_id) {
                    discordOutputs.push({ channel: entry.channel_id, ...embedPayload });
                } else if (entry.user_id) {
                    discordOutputs.push({ user: entry.user_id, ...embedPayload });
                }
            });
        }

        // Build the message payload (output 1)
        msg.payload = {
            message: duressMsg,
            title: 'EMERGENCY: Alarm System Alert',
            topic: 'EMERGENCY: Alarm System Alert',
            footer_text: `Alert System - ${ts}`,
            version: SCRIPT_VERSION,
            generated_at: now.toISOString(),
            execution_id: executionId,
            alert_type: 'DURESS',
            priority: 'CRITICAL'
        };
        log('[Debug] payload assigned');
        log('[Debug] Async success, returning msg');
        // Output 1: main alert, Output 2: array of Discord outputs (or null)
        node.done();
        return [msg, discordOutputs.length > 0 ? discordOutputs : null];
    } catch (error) {
        log(`[ERROR] Failed to generate duress alert: ${error.message}`, 'error');
        // Return a minimal error payload instead of null
        return [{
            payload: {
                message: 'EMERGENCY: System Error - Unable to generate duress alert',
                title: 'SYSTEM ERROR',
                topic: 'SYSTEM ERROR',
                error: error.message,
                execution_id: executionId,
                generated_at: now.toISOString(),
                alert_type: 'ERROR',
                priority: 'HIGH'
            }
        }, null];
    }
})();