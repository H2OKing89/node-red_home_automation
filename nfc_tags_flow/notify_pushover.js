// Name: Pushover Notification Builder (Refactored v2.0)
// Version: 2025-04-16
// Description: Builds a Pushover payload for tag-scan notifications, with improved destructuring,
// single-timestamp handling, DRY HTML builder, rate-limiting helper, and full try/catch.

node.warn('Pushover builder triggered');
const moment = global.get('moment');
node.warn(`Moment loaded: ${moment ? 'yes' : 'no'}`);
const pushoverConfig = (() => ({
    token: global.get("pushoverTokens")?.adminToken,
    user: global.get("pushoverUserKeys")?.quentinUserKey
}))();
node.warn(`Pushover config: token=${!!pushoverConfig.token}, user=${!!pushoverConfig.user}`);

function formatDate(dateInput, timeZone = 'America/Chicago') {
    try {
        const formatted = moment.tz(dateInput, timeZone)
            .format('dddd, MMMM D, YYYY [at] hh:mm:ss A z');
        node.warn(`Formatted date: ${formatted}`);
        return formatted;
    } catch (err) {
        node.warn("Date formatting failed: " + err.message);
        return dateInput;
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function logMessage(level, message) {
    const debugging = context.get('debugging') ?? true;
    if (debugging) node.warn(`[${new Date().toISOString()}] [${level}] ${message}`);
}

try {
    node.warn('Destructuring msg.payload');
    const {
        payload: {
            data: {
                title = "No Title",
                message: messageText = "No message provided",
                details = "",
                timestamp: rawTs = new Date().toISOString()
            } = {},
            icon = null,
            tag_name: tagName = "Unknown Tag",
            user_name: userName = "Unknown User"
        } = {}
    } = msg;
    node.warn(`Payload values: title='${title}', message='${messageText}', tag='${tagName}', user='${userName}', rawTs='${rawTs}'`);

    if (!moment) {
        node.error("Moment-timezone not loaded");
        return null;
    }
    if (!pushoverConfig.token || !pushoverConfig.user) {
        node.error("Missing Pushover configuration");
        return null;
    }

    let tsDate = new Date(rawTs);
    node.warn(`Parsed tsDate: ${tsDate.toISOString()}`);
    if (isNaN(tsDate.getTime())) {
        node.warn("Invalid timestamp provided, using current time.");
        tsDate = new Date();
    }
    const formattedTime = formatDate(tsDate);
    const pushoverTs = Math.floor(tsDate.getTime() / 1000);
    node.warn(`Unix timestamp: ${pushoverTs}`);

    const notificationConfig = {
        emergencyPriority: 2,
        normalPriority: 0,
        retry: 30,
        expire: 3600,
        sound: "persistent",
        rateLimitMs: 15000
    };
    const { emergencyPriority, normalPriority, retry, expire, sound, rateLimitMs } = notificationConfig;

    function shouldSend() {
        const now = Date.now();
        const last = context.get("lastPushoverTime") || 0;
        node.warn(`Rate-limit check: now=${now}, last=${last}, rateLimitMs=${rateLimitMs}`);
        if (now - last < rateLimitMs) {
            logMessage("WARN", "Rate limit hit. Skipping message.");
            return false;
        }
        context.set("lastPushoverTime", now);
        return true;
    }
    if (!shouldSend()) return null;

    const severity = (title + messageText).toLowerCase().includes("error")
        ? "critical"
        : "normal";
    node.warn(`Determined severity: ${severity}`);

    const htmlParts = [];
    const addPart = (cond, part) => cond && htmlParts.push(part);
    addPart(severity === "critical", `🔒 <b>Unauthorized Access Detected</b>`);
    addPart(true, `<b>${title}</b>`);
    addPart(!!messageText, escapeHtml(messageText));
    addPart(true, `User: <b>${escapeHtml(userName)}</b>`);
    addPart(true, `Tag: <font color="${severity === "critical" ? "#cc0000" : "#009900"}"><b>${escapeHtml(tagName)}</b></font>`);
    addPart(true, `Time: <u>${formattedTime}</u>`);
    addPart(!!icon, `<a href="${icon}">📷 View Image</a>`);
    addPart(!!details, `<font color="#888888">${escapeHtml(details)}</font>`);
    const htmlFormattedMessage = htmlParts.join('<br>');
    node.warn(`Constructed HTML message: ${htmlFormattedMessage}`);

    const payload = {
        token: pushoverConfig.token,
        user: pushoverConfig.user,
        title: severity === "critical"
            ? "🔒 Unauthorized Scan"
            : `✅ Scan by ${escapeHtml(userName)}`,
        message: htmlFormattedMessage,
        html: 1,
        sound,
        priority: severity === "critical" ? emergencyPriority : normalPriority,
        timestamp: pushoverTs
    };
    if (payload.priority === emergencyPriority) {
        payload.retry = retry;
        payload.expire = expire;
        node.warn(`Set emergency retry=${retry}, expire=${expire}`);
    }

    logMessage("INFO", `Sending Pushover payload`);
    node.warn(`Final payload: ${JSON.stringify(payload)}`);

    msg.payload = payload;
    return msg;

} catch (err) {
    node.error("Exception in builder", err);
    return null;
}
