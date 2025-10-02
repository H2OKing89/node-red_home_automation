/****************************************************
 * Script Name: Duress Alarm Test Message Generator
 * Author: Quentin King
 * Version: 1.7.0
 ****************************************************/

const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.7.0';
const executionId = `${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

// Standard format strings per documentation
const FORMATS = {
    push: "MMMM do, yyyy h:mm a zzz",
    tts: "MMMM do, yyyy 'at' h:mm a zzz",
    iso: "yyyy-MM-dd HH:mm:ss"
};

// Error handling for missing libraries per documentation standards
if (!dateFnsTz?.formatInTimeZone) {
    node.error('[alarm_duress_test] date-fns-tz not available in global context');
    return null;
}

// Standard function per documentation
function getFormattedTimes(date = new Date()) {
    if (!dateFnsTz?.formatInTimeZone) {
        node.warn('[alarm_duress_test] date-fns-tz not available. Using fallback.');
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
    
    try {
        return {
            formattedTimePush: formatInTimeZone(date, TIME_ZONE, FORMATS.push),
            formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, FORMATS.tts)
        };
    } catch (error) {
        node.error(`[alarm_duress_test] Error formatting date: ${error.message}`);
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
}

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
 * @param {Object} obj - Test message object with meta, message, law_enforcement, user, and extras.
 * @param {string} ts - Timestamp string.
 * @returns {string}
 */
function buildTestMessage(obj, ts) {
    const { message, law_enforcement, user } = obj;
    
    // Build law enforcement info
    const lawEnforcementInfo = `${law_enforcement.name}\n${law_enforcement.city}, ${law_enforcement.state}\nPhone: ${law_enforcement.phone}${law_enforcement.message ? `\n${law_enforcement.message}` : ''}`;
    
    // Build user info
    const userInfo = `${user.name}: ${user.address}, ${user.city}, ${user.state} ${user.zip}\nPhone: ${user.phone}`;
    
    // Build scene message with passphrase
    const sceneInfo = `${message.scene_msg}\nPassphrase: ${message.passphrase}`;
    
    return `[TEST] ${message.intro}\n\n${lawEnforcementInfo}\n\n${userInfo}\n\n${sceneInfo}\n\n${ts}`;
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
    const now = new Date();
    const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(now);
    try {
        // Update node status to show processing
        node.status({ fill: "yellow", shape: "dot", text: "Processing test alert..." });
        
        log('[Debug] Async function start');
        const ts = formattedTimePush;
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
            generated_at: now.toISOString(),
            execution_id: executionId,
            alert_type: 'DURESS_TEST',
            priority: 'INFO'
        };
        log('[Debug] payload assigned');
        log('[Debug] Async success, returning msg');
        
        // Update node status to show success
        node.status({ fill: "green", shape: "dot", text: `TEST alert sent at ${ts.split(',')[1].trim()}` });
        
        // Store test activation in context for tracking
        const testHistory = context.get('test_history') || [];
        testHistory.push({
            timestamp: now.toISOString(),
            execution_id: executionId,
            formatted_time: ts
        });
        // Keep only last 10 test runs
        if (testHistory.length > 10) {
            testHistory.shift();
        }
        context.set('test_history', testHistory);
        
        // Output 1: main test alert, Output 2: array of Discord outputs (or null)
        node.done();
        return [msg, discordOutputs.length > 0 ? discordOutputs : null];
    } catch (error) {
        log(`[ERROR] Failed to generate duress test alert: ${error.message}`, 'error');
        
        // Update node status to show error
        node.status({ fill: "red", shape: "ring", text: `Error: ${error.message}` });
        
        // Trigger catch node with proper error handling
        node.error(error, msg);
        
        // Return a minimal error payload instead of null
        const errorMsg = {
            payload: {
                message: '[TEST] System Error - Unable to generate duress test alert',
                title: 'SYSTEM ERROR',
                topic: 'SYSTEM ERROR',
                error: error.message,
                execution_id: executionId,
                generated_at: now.toISOString(),
                alert_type: 'ERROR',
                priority: 'HIGH'
            }
        };
        
        node.done();
        return [errorMsg, null];
    }
})();
