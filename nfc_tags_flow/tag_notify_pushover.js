/**
 * Node-RED Function: Pushover Notification Builder (Refactored v3.3)
 * Version: 2025-07-16
 * Description: Builds a Pushover payload for tag-scan notifications with improved error handling,
 * simplified configuration constants, enhanced logging, and Node-RED best practices.
 * Uses date-fns/date-fns-tz for timezone-aware date formatting.
 */

// --- Standard Date Formatting Setup ---
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago';

// --- Error Handling for Missing Libraries ---
if (!dateFnsTz?.formatInTimeZone) {
    node.error('date-fns-tz not available in global context', msg);
    return null;
}

// --- Get Pushover Configuration ---
const pushoverConfig = (() => ({
    token: global.get("pushoverTokens")?.adminToken,
    user: global.get("pushoverUserKeys")?.quentinUserKey
}))();

// Validate configuration early
if (!pushoverConfig.token || !pushoverConfig.user) {
    node.error("Missing Pushover configuration - check global context", msg);
    return null;
}

// --- Helper Functions ---

/**
 * Format a date input to human-readable string
 * @param {string|Date} dateInput - Date to format
 * @param {string} timeZone - IANA timezone string
 * @returns {string} Formatted date string
 */
function formatDate(dateInput, timeZone = TIME_ZONE) {
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid date input');
        }
        
        const formatted = formatInTimeZone(date, timeZone, "EEEE, MMMM d, yyyy 'at' hh:mm:ss a zzz");
        return formatted;
    } catch (err) {
        node.warn(`Date formatting failed: ${err.message}`);
        // Fallback to ISO string
        return new Date(dateInput).toISOString();
    }
}

/**
 * Escape HTML characters to prevent injection
 * @param {string} str - String to escape
 * @returns {string} HTML-escaped string
 */

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Check rate limiting to prevent spam
 * @returns {boolean} Whether message should be sent
 */
function shouldSend() {
    const now = Date.now();
    const last = context.get("lastPushoverTime") || 0;
    const rateLimitMs = 15000; // 15 seconds
    
    if (now - last < rateLimitMs) {
        node.warn("Rate limiting: Skipping notification - too frequent");
        return false;
    }
    
    context.set("lastPushoverTime", now);
    return true;
}

// --- Main Function Logic ---
try {
    // Validate message structure
    if (!msg || typeof msg !== 'object') {
        node.error("Invalid message object", msg);
        return null;
    }
    // Extract payload data with safe destructuring
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

    // Apply rate limiting
    if (!shouldSend()) {
        return null;
    }

    // Parse and validate timestamp
    let tsDate = new Date(rawTs);
    if (isNaN(tsDate.getTime())) {
        node.warn("Invalid timestamp received, using current time");
        tsDate = new Date();
    }
    
    const formattedTime = formatDate(tsDate);
    const pushoverTs = Math.floor(tsDate.getTime() / 1000);

    // Configuration constants (simplified as per Node-RED best practices)
    const EMERGENCY_PRIORITY = 2;
    const NORMAL_PRIORITY = 0;
    const RETRY_SECONDS = 30;
    const EXPIRE_SECONDS = 3600;
    const NORMAL_SOUND = "classical";
    const EMERGENCY_SOUND = "persistent";

    // Determine message severity
    const severity = (title + messageText).toLowerCase().includes("error") ? "critical" : "normal";
    
    // Set sound based on severity
    const sound = severity === "critical" ? EMERGENCY_SOUND : NORMAL_SOUND;

    // Build HTML message parts
    const htmlParts = [];
    const addPart = (condition, part) => condition && htmlParts.push(part);
    
    addPart(severity === "critical", `🔒 <b>Unauthorized Access Detected</b>`);
    addPart(true, `<b>${title}</b>`);
    addPart(!!messageText, escapeHtml(messageText));
    addPart(true, `User: <b>${escapeHtml(userName)}</b>`);
    addPart(true, `Tag: <font color="${severity === "critical" ? "#cc0000" : "#009900"}"><b>${escapeHtml(tagName)}</b></font>`);
    addPart(true, `Time: <u>${formattedTime}</u>`);
    addPart(!!icon, `<a href="${icon}">📷 View Image</a>`);
    addPart(!!details, `<font color="#888888">${escapeHtml(details)}</font>`);
    
    const htmlFormattedMessage = htmlParts.join('<br>');

    // Build Pushover payload
    const payload = {
        token: pushoverConfig.token,
        user: pushoverConfig.user,
        title: severity === "critical" 
            ? "🔒 Unauthorized Scan" 
            : `✅ Scan by ${escapeHtml(userName)}`,
        message: htmlFormattedMessage,
        html: 1,
        sound,
        priority: severity === "critical" ? EMERGENCY_PRIORITY : NORMAL_PRIORITY,
        timestamp: pushoverTs
    };
    
    // Add retry/expire for emergency priority
    if (payload.priority === EMERGENCY_PRIORITY) {
        payload.retry = RETRY_SECONDS;
        payload.expire = EXPIRE_SECONDS;
    }

    // Update message payload and return
    msg.payload = payload;
    
    node.log(`Pushover notification created for user: ${userName}`);
    
    return msg;

} catch (err) {
    // Follow Node-RED error handling best practice
    node.error(`Pushover notification builder failed: ${err.message}`, msg);
    return null;
}
