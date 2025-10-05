/****************************************************
 * Script Name: Duress Alarm Test Message Generator
 * Author: Quentin King
 * Version: 1.11.0
 ****************************************************/

const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.11.0';
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

// Small helpers to keep Discord limits happy
const clamp = (s, n) => (s ?? "").toString().slice(0, n);
const joinNonEmpty = (arr, sep = " ") => arr.filter(Boolean).map(x => x.toString()).join(sep);

log(`[Debug] Script start: executionId=${executionId}`);
msg = msg || {};

/**
 * Build the duress message from JSON fields (human-readable text version).
 * Supports schema v2 (headline/summary/...) with fallback to v1 (intro).
 */
function buildTestMessage(obj, ts) {
    const { message, law_enforcement, user, meta } = obj;

    // v2 fields (preferred)
    const headline    = message.headline;
    const summary     = message.summary;
    const purpose     = message.purpose;
    const instruction = message.instruction;
    const disclaimer  = message.disclaimer;

    // v1 fallback
    const intro = message.intro;

    // Law enforcement & user
    const leInfo = `${law_enforcement.name}\n${law_enforcement.city}, ${law_enforcement.state}\nPhone: ${law_enforcement.phone}${law_enforcement.message ? `\n${law_enforcement.message}` : ""}`;
    const userInfo = `${user.name}: ${user.address}, ${user.city}, ${user.state} ${user.zip}\nPhone: ${user.phone}`;

    // Scene/passphrase
    const sceneLine = message.scene_msg || "Example 'Scene SAFE' line for drills.";
    const sceneInfo = `${sceneLine}\nPassphrase: ${message.passphrase || "***REDACTED***"}`;

    // Compose body (prefer v2 parts, fallback to v1 intro)
    const top = headline
        ? joinNonEmpty([headline, summary, purpose, instruction, disclaimer], "\n")
        : (intro || "Duress Alert");

    return `${top}\n\n${leInfo}\n\n${userInfo}\n\n${sceneInfo}\n\n${ts}`;
}

/**
 * Build a Discord payload from canonical JSON (schema v2 with v1 fallback).
 * Per-target opts: { trusted, mention, role_id, image_url }
 */
function buildDiscordEmbed(obj, now, opts = {}) {
    const { trusted = false, mention = "everyone", role_id = null, image_url = null } = opts;

    const isTest   = !!obj?.meta?.test;
    const drill    = obj?.meta?.drill_name || "Duress Drill";
    const schedStr = `${obj?.meta?.scheduled_local_time || "12:00"} ${obj?.meta?.scheduled_tz || "America/Chicago"}`;

    const le  = obj?.law_enforcement || {};
    const usr = obj?.user || {};
    const msg = obj?.message || {};

    // —— Title & description (v2 preferred) ——
    // Use headline as title if provided; else keep your classic title
    const title = msg.headline
        ? clamp(msg.headline, 256)
        : (isTest ? `🚨 DURESS ALERT (TEST) — ${drill}` : "🚨 DURESS ALERT — Emergency Help Needed");

    // Keep description short; push long text into fields
    const description = clamp(
        joinNonEmpty([msg.summary, msg.purpose], "  "),
        1800
    ) || clamp(msg.intro || "", 1800); // v1 fallback

    // —— Authority / Subject ——
    const authorityStr = clamp(
        `${le.name || "Law Enforcement"} — ${le.city || ""}, ${le.state || ""}\n📞 ${le.phone || "N/A"}`,
        1000
    );

    const subjectPublic  = clamp(`${usr.name || "Subject"} — ${usr.city || ""}, ${usr.state || ""} ${usr.zip || ""}\n📞 ${usr.phone || "N/A"}`, 1000);
    const subjectTrusted = clamp(`${usr.name || "Subject"}\n${usr.address || ""}, ${usr.city || ""}, ${usr.state || ""} ${usr.zip || ""}\n📞 ${usr.phone || "N/A"}`, 1000);
    const subjectStr = trusted ? subjectTrusted : subjectPublic;

    // —— Passphrase / scene line ——
    const passRaw = msg.passphrase || "***REDACTED***";
    const passphraseStr = `\`${passRaw}\``;
    const sceneLine = clamp(msg.scene_msg || "Example 'Scene SAFE' line for drills.", 512);

    // —— Mentions ——
    let content = "";
    const allowed = { parse: [] };
    if (mention === "everyone") {
        content = "@everyone";
        allowed.parse.push("everyone");
    } else if (mention === "here") {
        content = "@here";
    } else if (mention === "role" && role_id) {
        content = `<@&${role_id}>`;
        allowed.parse.push("roles");
    }
    if (content) {
        content += isTest
            ? " 🚨 **TEST DURESS DRILL** — no action required."
            : " 🚨 **REAL DURESS ALERT** — immediate action required.";
    }

    // —— Fields (respect 1024/field) ——
    const fields = [
        { name: "Authority", value: authorityStr, inline: false },
        { name: isTest ? "Test Subject" : "Person in Distress", value: subjectStr, inline: false },
        // Timestamp vs Drill details
        isTest
            ? { name: "Drill Details", value: clamp(`**Name:** ${drill}\n**Scheduled:** ${schedStr}`, 1000), inline: false }
            : { name: "Timestamp", value: `<t:${Math.floor(now.getTime() / 1000)}:f>`, inline: false },
        // Passphrase block
        { name: isTest ? "Passphrase (TEST)" : "Passphrase for Safety Verification", value: clamp(`${passphraseStr} — ${sceneLine}`, 1000), inline: false }
    ];

    // Instruction & Disclaimer (v2 extras) — keep them as separate fields so description stays lean
    if (msg.instruction) {
        fields.push({ name: "Instruction", value: clamp(msg.instruction, 1000), inline: false });
    }
    if (msg.disclaimer) {
        fields.push({ name: "Disclaimer", value: clamp(msg.disclaimer, 1000), inline: false });
    }

    // "Important" line for tests - include mention in the field value
    if (isTest) {
        // Build the important message with mention prefix if present
        let importantMsg = "This is a **drill**. Do not contact law enforcement or dispatch from this message.";
        if (content) {
            importantMsg = `${content}\n\n${importantMsg}`;
        }
        fields.push({
            name: "Important",
            value: importantMsg,
            inline: false
        });
    }

    // Build embed
    const embed = {
        title,
        description,
        color: isTest ? 3447003 : 16711680,
        fields,
        footer: { text: `Schema v${obj?.meta?.schema_version ?? 1} • ${isTest ? "TEST" : "LIVE"} payload • Script v${SCRIPT_VERSION} • exec:${executionId}` },
        timestamp: now.toISOString()
    };

    // For TEST use thumbnail to keep the card compact; reserve big image for LIVE
    if (image_url) {
        if (isTest) embed.thumbnail = { url: image_url };
        else embed.image = { url: image_url };
    }

    return {
        content,
        allowed_mentions: allowed,
        action: "create",
        embeds: [embed]
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
                const fallbackPrefix = testMsgRaw?.includes("TEST") || testMsgRaw?.includes("test") ? "[TEST] " : "";
                testMsg = `${fallbackPrefix}${(testMsgRaw || "Duress Alarm Message")} ${ts}`;
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
        // Each entry in env DURESS_DISCORD_ID can carry per-target options:
        // {
        //   "duress_discord_id": [
        //     { "channel_id": "123", "mention": "everyone", "trusted": true,  "image_url": "https://...gif" },
        //     { "channel_id": "456", "mention": "none",     "trusted": false },
        //     { "user_id":    "789", "mention": "here" },
        //     { "channel_id": "999", "mention": "role", "role_id": "112233445566778899" }
        //   ]
        // }
        const discordOutputs = [];
        if (testObj && Array.isArray(discordTargets) && discordTargets.length > 0) {
            discordTargets.forEach(entry => {
                const opts = {
                    trusted: !!entry.trusted,
                    mention: entry.mention || "everyone",
                    role_id: entry.role_id || null,
                    image_url: entry.image_url || "https://ptpimg.me/2v95ml.gif"  // keep your legacy image unless overridden
                };

                const payload = buildDiscordEmbed(testObj, now, opts);

                if (entry.channel_id) {
                    discordOutputs.push({ channel: entry.channel_id, ...payload });
                } else if (entry.user_id) {
                    discordOutputs.push({ user: entry.user_id, ...payload });
                } else {
                    log(`[Discord] Skipping entry with no channel_id/user_id: ${JSON.stringify(entry)}`, "warn");
                }
            });
        }

        // Build the message payload (output 1)
        const isTest = !!testObj?.meta?.test;
        const alertType = isTest ? "DURESS_TEST" : "DURESS_LIVE";
        const priority = isTest ? "INFO" : "CRITICAL";
        
        // Use headline from JSON if available, otherwise construct from mode
        const payloadTitle = testObj?.message?.headline 
            || `${isTest ? "[TEST] " : ""}DURESS Alarm System Check`;
        const payloadTopic = testObj?.message?.headline 
            || `${isTest ? "[TEST] " : ""}DURESS Alarm System Check`;
        
        msg.payload = {
            message: testMsg,
            title: payloadTitle,
            topic: payloadTopic,
            footer_text: `${isTest ? "Test" : "Live"} Alert System - ${ts}`,
            version: SCRIPT_VERSION,
            generated_at: now.toISOString(),
            execution_id: executionId,
            alert_type: alertType,
            priority: priority
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
        node.send([msg, discordOutputs.length > 0 ? discordOutputs : null]);
    } catch (error) {
        log(`[ERROR] Failed to generate duress test alert: ${error.message}`, 'error');
        
        // Update node status to show error
        node.status({ fill: "red", shape: "ring", text: `Error: ${error.message}` });
        
        // Trigger catch node with proper error handling
        node.error(error, msg);
    } finally {
        node.done();
    }
})();
return;
