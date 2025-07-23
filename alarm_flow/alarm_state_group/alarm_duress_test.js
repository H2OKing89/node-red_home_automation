/****************************************************
 * Script Name: Duress Alarm Test Message Generator
 * Author: Quentin King
 * Version: 1.6.10
 ****************************************************/

const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.6.10';
const executionId = `${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

function log(message, level = "info") {
    if (!LOGGING_ENABLED) return;
    if (level === "error") node.error(message);
    else if (level === "warn") node.warn(message);
    else node.log(message);
}

log(`[Debug] Script start: executionId=${executionId}`);
msg = msg || {};

/**
 * Build the duress test message from JSON fields.
 * @param {Object} obj - Test message object.
 * @param {string} ts - Timestamp string.
 * @returns {string}
 */
function buildTestMessage(obj, ts) {
    return `[TEST] ${obj.intro}\n\n${obj.law_enforcement}\n${obj.name}: ${obj.address}, ${obj.city}, ${obj.state}\nPhone: ${obj.phone}\n\n${obj.scene_msg} ${obj.passphrase}\n\n${ts}`;
}

/**
 * Build a Discord embed payload for test alerts.
 * @param {Object} obj - Test message object.
 * @param {string} ts - Timestamp string.
 * @param {string} testMsgDiscord - The formatted Discord message.
 * @param {Date} now - The timestamp to use for all outputs.
 * @returns {Object}
 */
function buildDiscordEmbed(obj, ts, testMsgDiscord, now) {
    const month = now.toLocaleString('default', { month: 'long' });
    const year = now.getFullYear();
    return {
        action: "create",
        embeds: [{
            title: `[TEST] DURESS Alarm System Check - ${month} ${year}`,
            description: testMsgDiscord,
            color: 16776960, // Yellow for test
            footer: {
                text: `<Version ${SCRIPT_VERSION}> By, Quentin King`
            },
            image: {
                url: "https://ptpimg.me/2v95ml.gif"
            },
            timestamp: now.toISOString()
        }]
    };
}

return (async () => {
    try {
        log('[Debug] Async function start');
        const now = new Date();
        const ts = formatInTimeZone(now, TIME_ZONE, "MM-dd-yyyy HH:mm:ss zzz");
        log(`[Debug] Timestamp=${ts}`);


        // Retrieve test message from environment
        let testMsgRaw = env.get("DURESS_TEST_MESSAGE");
        let testMsg, testMsgDiscord, testObj;
        if (typeof testMsgRaw === 'object' && testMsgRaw !== null) {
            testObj = testMsgRaw;
            testMsg = buildTestMessage(testObj, ts);
            testMsgDiscord = `@everyone ${testMsg}`;
        } else {
            try {
                testObj = JSON.parse(testMsgRaw);
                testMsg = buildTestMessage(testObj, ts);
                testMsgDiscord = `@everyone ${testMsg}`;
            } catch (e) {
                testMsg = `[TEST] ${(testMsgRaw || "Duress Alarm Test Message")} ${ts}`;
                testMsgDiscord = `@everyone ${testMsg}`;
                testObj = null;
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
        if (testObj && discordTargets.length > 0) {
            const embedPayload = buildDiscordEmbed(testObj, ts, testMsgDiscord, now);
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
            message: testMsg,
            title: '[TEST] DURESS Alarm System Check',
            topic: '[TEST] DURESS Alarm System Check',
            footer_text: `Test Alert System - ${ts}`,
            version: SCRIPT_VERSION,
            generated_at: new Date().toISOString(),
            execution_id: executionId,
            alert_type: 'DURESS_TEST',
            priority: 'INFO'
        };
        log('[Debug] payload assigned');
        log('[Debug] Async success, returning msg');
        // Output 1: main test alert, Output 2: array of Discord outputs (or null)
        return [msg, discordOutputs.length > 0 ? discordOutputs : null];
    } catch (error) {
        log(`[ERROR] Failed to generate duress test alert: ${error.message}`, 'error');
        // Return a minimal error payload instead of null
        return [{
            payload: {
                message: '[TEST] System Error - Unable to generate duress test alert',
                title: 'SYSTEM ERROR',
                topic: 'SYSTEM ERROR',
                error: error.message,
                execution_id: executionId,
                generated_at: new Date().toISOString(),
                alert_type: 'ERROR',
                priority: 'HIGH'
            }
        }, null];
    }
})();
