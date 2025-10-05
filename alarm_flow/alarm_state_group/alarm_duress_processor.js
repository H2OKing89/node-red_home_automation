/****************************************************
 * Script Name: Duress Alarm Code Alert Generator
 * Author: Quentin King
 * Version: 2.0.0
 ****************************************************/

// Toggle all logging on or off
const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '2.0.0';
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

// Small helpers to keep Discord limits happy
const clamp = (s, n) => (s ?? "").toString().slice(0, n);
const joinNonEmpty = (arr, sep = " ") => arr.filter(Boolean).map(x => x.toString()).join(sep);

/**
 * Build the duress alert message from JSON fields (human-readable text version).
 * Supports schema v2 (headline/summary/...) with fallback to v1 (intro).
 * @param {Object} obj - Duress message object with meta, message, law_enforcement, user, and extras.
 * @param {string} ts - Timestamp string.
 * @returns {string}
 */
function buildDuressMessage(obj, ts) {
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
    const sceneLine = message.scene_msg || "Scene verification line.";
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
 * @param {Object} obj - Duress message object.
 * @param {Date} now - The timestamp to use for all outputs.
 * @param {Object} opts - Per-target options { trusted, mention, role_id, image_url }
 * @returns {Object}
 */
function buildDiscordEmbed(obj, now, opts = {}) {
    const { trusted = false, mention = "everyone", role_id = null, image_url = null } = opts;

    const isTest   = !!obj?.meta?.test;
    const le  = obj?.law_enforcement || {};
    const usr = obj?.user || {};
    const msg = obj?.message || {};

    // —— Title & description (v2 preferred) ——
    const title = msg.headline
        ? clamp(msg.headline, 256)
        : "🚨 DURESS ALERT — Emergency Help Needed";

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
    const sceneLine = clamp(msg.scene_msg || "Scene verification line.", 512);

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
        content += " 🚨 **REAL DURESS ALERT** — immediate action required.";
    }

    // —— Fields (respect 1024/field) ——
    const fields = [
        { name: "Authority", value: authorityStr, inline: false },
        { name: "Person in Distress", value: subjectStr, inline: false },
        { name: "Timestamp", value: `<t:${Math.floor(now.getTime() / 1000)}:f>`, inline: false },
        { name: "Passphrase for Safety Verification", value: clamp(`${passphraseStr} — ${sceneLine}`, 1000), inline: false }
    ];

    // Instruction & Disclaimer (v2 extras)
    if (msg.instruction) {
        fields.push({ name: "Instruction", value: clamp(msg.instruction, 1000), inline: false });
    }
    if (msg.disclaimer) {
        fields.push({ name: "Disclaimer", value: clamp(msg.disclaimer, 1000), inline: false });
    }

    // Build embed
    const embed = {
        title,
        description,
        color: 16711680, // Red for LIVE alerts
        fields,
        footer: { text: `Schema v${obj?.meta?.schema_version ?? 1} • LIVE payload • Script v${SCRIPT_VERSION} • exec:${executionId}` },
        timestamp: now.toISOString()
    };

    // For LIVE alerts, use full image
    if (image_url) {
        embed.image = { url: image_url };
    }

    return {
        content,
        allowed_mentions: allowed,
        action: "create",
        embeds: [embed]
    };
}

// Main async IIFE to build and return the alert message
return (async () => {
    const now = new Date();
    const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(now);
    try {
        // Update node status to show processing
        node.status({ fill: "yellow", shape: "dot", text: "Processing duress alert..." });
        
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
        if (duressObj && Array.isArray(discordTargets) && discordTargets.length > 0) {
            discordTargets.forEach(entry => {
                const opts = {
                    trusted: !!entry.trusted,
                    mention: entry.mention || "everyone",
                    role_id: entry.role_id || null,
                    image_url: entry.image_url || "https://ptpimg.me/4kt5j5.gif"
                };

                const payload = buildDiscordEmbed(duressObj, now, opts);

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
        const isTest = !!duressObj?.meta?.test;
        const alertType = isTest ? "DURESS_TEST" : "DURESS_LIVE";
        const priority = isTest ? "INFO" : "CRITICAL";
        
        // Use headline from JSON if available, otherwise construct from mode
        const payloadTitle = duressObj?.message?.headline 
            || 'EMERGENCY: Alarm System Alert';
        const payloadTopic = duressObj?.message?.headline 
            || 'EMERGENCY: Alarm System Alert';
        
        // Preserve important msg properties per Section 1.1 best practice
        msg.payload = {
            message: duressMsg,
            title: payloadTitle,
            topic: payloadTopic,
            footer_text: `Alert System - ${ts}`,
            version: SCRIPT_VERSION,
            generated_at: now.toISOString(),
            execution_id: executionId,
            alert_type: alertType,
            priority: priority
        };
        // Preserve original message ID and any existing topic for traceability
        if (msg._msgid === undefined) msg._msgid = executionId;
        if (!msg.topic) msg.topic = payloadTopic;
        
        log('[Debug] payload assigned');
        log('[Debug] Async success, returning msg');
        
        // Update node status to show success
        node.status({ fill: "red", shape: "dot", text: `DURESS alert sent at ${ts.split(',')[1].trim()}` });
        
        // Clear status after 30 seconds to avoid stale indicators (Section 5 best practice)
        //setTimeout(() => node.status({}), 30000);
        
        // Store duress activation in context for tracking
        const duressHistory = context.get('duress_history') || [];
        duressHistory.push({
            timestamp: now.toISOString(),
            execution_id: executionId,
            formatted_time: ts
        });
        // Keep only last 10 activations
        if (duressHistory.length > 10) {
            duressHistory.shift();
        }
        context.set('duress_history', duressHistory);
        
        // Output 1: main alert, Output 2: array of Discord outputs (or null)
        node.send([msg, discordOutputs.length > 0 ? discordOutputs : null]);
    } catch (error) {
        log(`[ERROR] Failed to generate duress alert: ${error.message}`, 'error');
        
        // Add diagnostic context per Section 9.6 of Node-RED best practices
        msg.errorMeta = {
            timestamp: now.toISOString(),
            executionId: executionId,
            payloadType: typeof msg.payload,
            scriptVersion: SCRIPT_VERSION,
            errorMessage: error.message,
            errorStack: error.stack
        };
        
        // Update node status to show error
        node.status({ fill: "red", shape: "ring", text: `Error: ${error.message}` });
        
        // Trigger catch node with proper error handling
        node.error(error, msg);
    } finally {
        node.done();
    }
})();