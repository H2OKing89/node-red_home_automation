/**
 * Node-RED Function: Pushover Notification Builder (Refactored v3.6)
 * Version: 2025-07-30
 * Description: Builds a Pushover payload for tag-scan notifications with improved error handling,
 * simplified configuration constants, enhanced logging, and Node-RED best practices.
 * Uses date-fns/date-fns-tz modules for timezone-aware date formatting.
 * 
 * Required Modules (add in Setup tab):
 * - date-fns-tz (version 2.0.0+)
 * - axios (for image downloading)
 * 
 * v3.6 Updates (Final Polish):
 * - Reverted to zzz timezone token (CDT format) per user preference
 * - Restored <font color> HTML tags (confirmed supported by Pushover API)
 * - Added newline-to-<br> conversion for details field
 * - Restored image size limit to 5MB (Pushover's actual limit) with content-type detection
 * - Eliminated rate limiting for critical messages (when fires burn, don't whisper)
 * - Added automatic cleanup of old rate-limit entries (24h retention)
 * - Enhanced image attachment with proper MIME type
 * 
 * v3.5 Updates:
 * - Fixed module guards to prevent crashes when modules missing
 * - Improved severity detection for unauthorized access patterns  
 * - Added per-key rate limiting with different thresholds by severity
 * - Enhanced HTML escaping including title field
 * - Added icon URL validation for security
 * - Ensured node.done() called on all exit paths
 * - Safer date fallback handling
 */

// --- Standard Date Formatting Setup ---
const TIME_ZONE = 'America/Chicago';

// --- Error Handling for Missing Libraries ---
const hasDFTz = (typeof dateFnsTz !== 'undefined') && typeof dateFnsTz.formatInTimeZone === 'function';
if (!hasDFTz) {
    node.error('date-fns-tz not available as module - add in Setup tab', msg);
    return null;
}
const { formatInTimeZone } = dateFnsTz;

// --- Module Availability Checks ---
const hasAxios = (typeof axios !== 'undefined');
if (!hasAxios) {
    node.warn('axios not available as module - image attachments disabled. Add axios to Setup tab.');
}

// --- Get Pushover Configuration ---
const pushoverConfig = (() => ({
    token: env.get("PO_TOKEN_ADMIN"),
    user: env.get("PO_USER_ADMIN")
}))();

// Validate configuration early
if (!pushoverConfig.token || !pushoverConfig.user) {
    node.error("Missing Pushover configuration - check environment variables");
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
        // Safe fallback to current time
        return new Date().toISOString();
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
 * Check rate limiting to prevent spam with per-key tracking
 * @param {string} key - Rate limiting key 
 * @param {number} minMs - Minimum milliseconds between messages
 * @returns {boolean} Whether message should be sent
 */
function shouldSend(key = 'default', minMs = 15000) {
    const now = Date.now();
    const map = context.get('rateLimitMap') || {};
    const last = map[key] || 0;
    
    // Opportunistic cleanup (remove entries older than 24h)
    if (Math.random() < 0.05) {
        const cutoff = now - 24*60*60*1000;
        for (const k of Object.keys(map)) {
            if (map[k] < cutoff) delete map[k];
        }
    }
    
    if (now - last < minMs) {
        node.warn(`Rate limiting: Skipping notification for key="${key}" (${now - last}ms < ${minMs}ms)`);
        return false;
    }
    
    map[key] = now;
    context.set('rateLimitMap', map);
    return true;
}

/**
 * Download image from URL for Pushover attachment
 * @param {string} imageUrl - URL of the image to download
 * @returns {Promise<Buffer|null>} Image buffer or null if failed
 */
async function downloadImage(imageUrl) {
    // Check if axios module is available
    if (!hasAxios || !imageUrl) {
        return null;
    }
    
    try {
        node.log(`Downloading image from: ${imageUrl}`);
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10 second timeout
            maxContentLength: 5242880, // 5MB limit (Pushover's actual limit)
            headers: {
                'User-Agent': 'Node-RED/Home-Automation'
            }
        });
        
        if (response.status === 200 && response.data) {
            const imageBuffer = Buffer.from(response.data);
            
            // Double-check size limit (5MB)
            if (imageBuffer.length > 5242880) {
                node.warn(`Image too large: ${imageBuffer.length} bytes (max 5MB)`);
                return null;
            }
            
            // Get content type for attachment
            const contentType = response.headers['content-type'] || 'image/jpeg';
            
            node.log(`Image downloaded successfully, size: ${imageBuffer.length} bytes, type: ${contentType}`);
            return { buffer: imageBuffer, contentType };
        }
        
        node.warn(`Failed to download image, status: ${response.status}`);
        return null;
        
    } catch (err) {
        node.warn(`Image download failed: ${err.message}`);
        return null;
    }
}

// --- Main Function Logic ---
(async function() {
    try {
        // Validate message structure
        if (!msg || typeof msg !== 'object') {
            node.error("Invalid message object", msg);
            node.done();
            return;
        }
        
        // Extract payload data with safe destructuring
        const {
            payload: {
                data: {
                    title = "No Title",
                    message: messageText = "No message provided",
                    details = "",
                    timestamp: rawTs = new Date().toISOString(),
                    severity: explicitSeverity = null
                } = {},
                icon = null,
                tag_name: tagName = "Unknown Tag",
                user_name: userName = "Unknown User"
            } = {}
        } = msg;

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

        // Improved severity detection with better pattern matching
        const lowered = `${title} ${messageText}`.toLowerCase();
        const isUnauthorized = /(unauthori[sz]ed|denied|forbidden|blocked|invalid|failed|access)/i.test(lowered);
        const isError = /(error|failure|exception|critical|emergency)/i.test(lowered);
        const severity = explicitSeverity || (isUnauthorized || isError ? 'critical' : 'normal');
        
        // Set sound based on severity
        const sound = severity === "critical" ? EMERGENCY_SOUND : NORMAL_SOUND;

        // Apply rate limiting with per-key tracking - no rate limit for critical messages
        const rlKey = `${severity}:${title}:${userName}`;
        const rlMs = severity === 'critical' ? 0 : 15000; // no limit for critical
        if (severity !== 'critical' && !shouldSend(rlKey, rlMs)) {
            node.done();
            return;
        }

        // Download image if available - validate icon URL first
        const safeIcon = (typeof icon === 'string' && /^https?:\/\//i.test(icon)) ? icon : null;
        let imageData = null;
        if (safeIcon) {
            imageData = await downloadImage(safeIcon);
        }

        // Build HTML message parts with proper escaping
        const htmlParts = [];
        const addPart = (condition, part) => condition && htmlParts.push(part);
        
        const safeTitle = escapeHtml(title);
        const safeDetails = details ? escapeHtml(details).replace(/\n/g, '<br>') : '';
        
        addPart(severity === "critical", `🔒 <b>Unauthorized Access Detected</b>`);
        addPart(true, `<b>${safeTitle}</b>`);
        addPart(!!messageText, escapeHtml(messageText));
        addPart(true, `User: <b>${escapeHtml(userName)}</b>`);
        addPart(true, `Tag: <font color="${severity === "critical" ? "#cc0000" : "#009900"}"><b>${escapeHtml(tagName)}</b></font>`);
        addPart(true, `Time: <u>${formattedTime}</u>`);
        // Only add image link if we couldn't download the image and URL is safe
        addPart(!!safeIcon && !imageData, `<a href="${escapeHtml(safeIcon)}">📷 View Image</a>`);
        addPart(!!safeDetails, `<font color="#888888">${safeDetails}</font>`);
        
        const htmlFormattedMessage = htmlParts.join('<br>');

        // Build Pushover payload
        const basePayload = {
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
        if (basePayload.priority === EMERGENCY_PRIORITY) {
            basePayload.retry = RETRY_SECONDS;
            basePayload.expire = EXPIRE_SECONDS;
        }

        // Handle image attachment using Base64 encoding
        if (imageData) {
            // Use Base64 encoding for image attachment
            basePayload.attachment_base64 = imageData.buffer.toString('base64');
            basePayload.attachment_type = imageData.contentType;
            node.log(`Image attachment added via Base64 encoding (${imageData.buffer.length} bytes, ${imageData.contentType})`);
        }

        // Set final payload
        msg.payload = basePayload;
        
        // Update node status
        node.status({
            fill: severity === "critical" ? "red" : "green",
            shape: "dot",
            text: `${severity} notification for ${userName}`
        });
        
        // Clear status after 5 seconds
        setTimeout(() => {
            node.status({});
        }, 5000);
        
        node.log(`Pushover notification created for user: ${userName}${imageData ? ' with image attachment' : ''}`);
        
        node.send(msg);
        node.done();

    } catch (err) {
        // Follow Node-RED error handling best practice
        node.error(`Pushover notification builder failed: ${err.message}`, msg);
        node.done();
    }
})();
