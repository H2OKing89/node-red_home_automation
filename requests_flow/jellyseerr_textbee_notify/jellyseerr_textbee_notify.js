/**
 * Script Name: Jellyseerr TextBee SMS Notification Handler
 * Version: 1.7.4
 * Date: 2025-10-18
 * 
 * Description:
 * Sends targeted SMS notifications via TextBee API for Jellyseerr webhook events.
 * Maps Jellyseerr users (by email or username) to phone numbers from TEXTBEE_CONFIG.
 * Only notifies users directly involved in the request/issue (requestor, reporter, commenter).
 * Supports multi-variant messages for natural, non-robotic notifications.
 * 
 * Recent Changes:
 * - 1.7.4: Bug fix: ISSUE_COMMENT messages now correctly use commenter's username instead of issue
 *          reporter's username for {username} placeholder. Fixes duplicate name display when same
 *          person comments (e.g., "Quentin King, Quentin King just added...").
 * - 1.7.3: Bug fix: Enhanced sanitization of deduplication keys to remove spaces in addition to colons.
 *          Fixes "Invalid property expression" errors when usernames contain spaces.
 * - 1.7.2: Enhanced node status with timezone-aware timestamps using date-fns-tz (America/Chicago).
 *          Shows "✓ Sent: Betty King 10/17/2025 22:47" format with fallback to local time.
 * 
 * Full Changelog: See CHANGELOG/CHANGELOG_v1.7.x.md for detailed version history
 * 
 * Setup Requirements:
 * - External Modules: 
 *   - date-fns-tz (v2.0.0+) as dateFnsTz - for timezone-aware timestamps (optional but recommended)
 * - Global Context (settings.js):
 *   - axios: require('axios')
 *   - TEXTBEE_CONFIG: Config object or JSON.stringify(config)
 * - OR Environment Variables (Node-RED UI):
 *   - TEXTBEE_CONFIG: Config object or JSON string
 * - Timeout: 30 seconds (for HTTP requests)
 * - Duplicate Squelch: 60 seconds (configurable via duplicate_squelch_ms)
 * 
 * Node-RED Setup:
 * - Setup Tab: Initialize state, validate config, pre-warm caches
 * - Main Tab: This file (message processing)
 * - Close Tab: Cleanup deduplication keys, log statistics
 * - Modules Tab: Add "date-fns-tz" (v2.0.0+) with variable name "dateFnsTz"
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const LOGGING_ENABLED = true;

// Time zone configuration for timestamps
const TIME_ZONE = 'America/Chicago';

// Check if date-fns-tz is available
const formatInTimeZone = dateFnsTz?.formatInTimeZone;
if (!formatInTimeZone) {
    node.warn('date-fns-tz not available - timestamps will use local server time');
}

// Events that should trigger SMS notifications
const SMS_EVENTS = [
    "MEDIA_AUTO_APPROVED",
    "MEDIA_APPROVED",
    "MEDIA_AVAILABLE",
    "MEDIA_PENDING",
    "MEDIA_DECLINED",
    "MEDIA_FAILED",
    "ISSUE_CREATED",
    "ISSUE_COMMENT",
    "ISSUE_REOPENED",
    "ISSUE_RESOLVED"
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Logging helper with conditional output
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, warn, error, debug)
 */
function log(message, level = "info") {
    if (!LOGGING_ENABLED) return;
    
    if (level === "error") {
        node.error(message);
    } else if (level === "warn") {
        node.warn(message);
    } else if (level === "debug") {
        node.debug(message);
    } else {
        node.log(message);
    }
}

/**
 * Format current time for node status display
 * @returns {string} Formatted time string (MM/DD/YYYY HH:mm)
 */
function getStatusTimestamp() {
    const now = new Date();
    
    if (formatInTimeZone) {
        // Use timezone-aware formatting (preferred)
        return formatInTimeZone(now, TIME_ZONE, 'M/d/yyyy HH:mm');
    } else {
        // Fallback to local server time
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${month}/${day}/${year} ${hours}:${minutes}`;
    }
}

/**
 * Mask phone number for PII-safe logging (handles international E.164 formats)
 * @param {string} phone - Phone number to mask
 * @returns {string} Masked phone (e.g., +1402***6154 or +44123***7890)
 */
function maskPhone(phone) {
    const p = String(phone || '');
    
    // E.164 format: +<country code><subscriber number>
    // Mask all but country code and last 2-4 digits
    const match = p.match(/^(\+?\d{1,3})(\d{5,12})$/);
    if (match) {
        const country = match[1];
        const subscriber = match[2];
        // Show first 2-3 digits, mask middle, show last 2-4 digits
        const showStart = 3;
        const showEnd = subscriber.length > 6 ? 4 : 2;
        const start = subscriber.slice(0, showStart);
        const end = subscriber.slice(-showEnd);
        const masked = '*'.repeat(subscriber.length - showStart - showEnd);
        return `${country}${start}${masked}${end}`;
    }
    
    // Fallback: mask all but last 4 digits if not E.164
    return p.replace(/.(?=.{4})/g, '*');
}

/**
 * Load and parse TEXTBEE_CONFIG from environment or global context
 * @returns {object|null} Parsed config or null on error
 */
function loadConfig() {
    try {
        let config = null;
        
        // Try environment variable first (Node-RED UI: Settings → Function → Environment Variables)
        const envConfig = env.get("TEXTBEE_CONFIG");
        if (envConfig) {
            log("Loading config from environment variable", "debug");
            // If it's already an object, use it directly
            if (typeof envConfig === 'object') {
                config = envConfig;
            } else {
                // Otherwise parse as JSON string
                config = JSON.parse(envConfig);
            }
        }
        
        // Fallback to global context (settings.js functionGlobalContext)
        if (!config) {
            log("Trying global context for config", "debug");
            const globalConfig = global.get('TEXTBEE_CONFIG');
            if (globalConfig) {
                if (typeof globalConfig === 'object') {
                    config = globalConfig;
                } else {
                    config = JSON.parse(globalConfig);
                }
            }
        }
        
        if (!config) {
            log("TEXTBEE_CONFIG not found in environment or global context", "error");
            return null;
        }
        
        // Validate required config fields
        if (!config.textbee || !config.textbee.api_key || !config.textbee.device_id) {
            log("Invalid TEXTBEE_CONFIG: missing required TextBee API fields", "error");
            return null;
        }
        
        if (!config.users || !Array.isArray(config.users) || config.users.length === 0) {
            log("Invalid TEXTBEE_CONFIG: no users configured", "error");
            return null;
        }
        
        log(`Loaded config with ${config.users.length} users`, "debug");
        return config;
        
    } catch (err) {
        log(`Failed to load TEXTBEE_CONFIG: ${err.message}`, "error");
        return null;
    }
}

/**
 * Normalize string for case-insensitive comparison
 * @param {string} str - String to normalize
 * @returns {string} Trimmed lowercase string
 */
function normalize(str) {
    return (str || '').trim().toLowerCase();
}

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Phone number in various formats
 * @returns {string} E.164 format phone (+1XXXXXXXXXX) or original if can't normalize
 */
function normalizePhone(phone) {
    const digits = (phone || '').replace(/\D/g, '');
    
    // Already E.164 format (11 digits starting with 1)
    if (digits.startsWith('1') && digits.length === 11) {
        return `+${digits}`;
    }
    
    // US/Canada 10-digit number
    if (digits.length === 10) {
        return `+1${digits}`;
    }
    
    // Leave as-is if already +1... format or non-US
    return phone;
}

/**
 * Find user in config by Jellyseerr identifier (case-insensitive)
 * @param {object} config - TextBee configuration
 * @param {string} email - User's Jellyseerr email
 * @param {string} username - User's Jellyseerr username
 * @returns {object|null} Matched user config or null
 */
function findUser(config, email, username) {
    const lookupBy = config.jellyseerr_lookup_by || "email";
    const normalizedEmail = normalize(email);
    const normalizedUsername = normalize(username);
    
    log(`Looking up user by ${lookupBy}: email="${email}", username="${username}"`, "debug");
    node.trace(`Normalized: email="${normalizedEmail}", username="${normalizedUsername}"`);
    
    for (const user of config.users) {
        const userEmail = normalize(user.jellyseerr_email);
        const userUsername = normalize(user.jellyseerr_username);
        
        if (lookupBy === "email" && normalizedEmail && userEmail === normalizedEmail) {
            log(`Matched user by email: ${user.name}`, "debug");
            return user;
        }
        
        if (lookupBy === "username" && normalizedUsername && userUsername === normalizedUsername) {
            log(`Matched user by username: ${user.name}`, "debug");
            return user;
        }
        
        // Fallback: try both if primary lookup fails
        if (normalizedEmail && userEmail === normalizedEmail) {
            log(`Matched user by email (fallback): ${user.name}`, "debug");
            return user;
        }
        
        if (normalizedUsername && userUsername === normalizedUsername) {
            log(`Matched user by username (fallback): ${user.name}`, "debug");
            return user;
        }
    }
    
    log(`No user found for email="${email}", username="${username}"`, "warn");
    return null;
}

/**
 * Extract media title from payload
 * @param {object} payload - Jellyseerr webhook payload
 * @returns {string} Media title or "Unknown Title"
 */
function extractMediaTitle(payload) {
    return payload.subject || payload.media?.title || "Unknown Title";
}

/**
 * Pick a variant from pool, avoiding immediate repeats
 * @param {Array} pool - Array of message variants
 * @param {string} eventType - Event type for context key
 * @returns {string|null} Selected variant or null
 */
function pickVariant(pool, eventType) {
    if (!Array.isArray(pool) || pool.length === 0) return null;
    
    const lastKey = `last_variant:${eventType}`;
    const lastIndex = context.get(lastKey);
    
    let randomIndex = Math.floor(Math.random() * pool.length);
    
    // Avoid back-to-back repeats if we have multiple variants
    if (pool.length > 1 && randomIndex === lastIndex) {
        randomIndex = (randomIndex + 1) % pool.length;
    }
    
    context.set(lastKey, randomIndex);
    return pool[randomIndex];
}

/**
 * Generate SMS message from template with multi-variant support
 * @param {object} config - TextBee configuration
 * @param {string} eventType - Jellyseerr event type
 * @param {object} user - User configuration
 * @param {object} payload - Jellyseerr webhook payload
 * @returns {string|null} Generated SMS message or null
 */
function generateSmsMessage(config, eventType, user, payload) {
    const templates = config.templates || {};
    const title = extractMediaTitle(payload);
    const userName = user.name || user.jellyseerr_username || "there";
    
    // Determine username based on event type
    let actorUsername = "Unknown";
    if (eventType === "ISSUE_COMMENT" && payload.comment?.commentedBy_username) {
        // For comments, use the commenter's username
        actorUsername = payload.comment.commentedBy_username;
    } else if (payload.request?.requestedBy_username) {
        // For request events, use the requester's username
        actorUsername = payload.request.requestedBy_username;
    } else if (payload.issue?.reportedBy_username) {
        // For issue events, use the reporter's username
        actorUsername = payload.issue.reportedBy_username;
    }
    
    // Template placeholders: {name}, {title}, {username}, {issue_type}
    const replacements = {
        "{name}": userName,
        "{title}": title,
        "{username}": actorUsername,
        "{issue_type}": payload.issue?.issue_type || "Unknown"
    };
    
    let templatePool = null;
    let fallbackMessage = null;
    
    // Map event types to template pools (arrays) or single strings
    switch (eventType) {
        case "MEDIA_AUTO_APPROVED":
        case "MEDIA_APPROVED":
            templatePool = templates.request_approved;
            fallbackMessage = "Hi {name}, your request for \"{title}\" has been approved and will begin downloading soon! — Jellyseerr";
            break;
            
        case "MEDIA_PENDING":
            templatePool = templates.request_added;
            fallbackMessage = "Hi {name}, your request for \"{title}\" has been added to the queue. — Jellyseerr";
            break;
            
        case "MEDIA_DECLINED":
            templatePool = templates.request_declined;
            fallbackMessage = "Hi {name}, your request for \"{title}\" has been declined. Please check with your media administrator for more information. — Jellyseerr";
            break;
            
        case "MEDIA_AVAILABLE":
            templatePool = templates.request_ready;
            fallbackMessage = "Hi {name}, \"{title}\" is now available to watch! — Jellyseerr";
            break;
            
        case "MEDIA_FAILED":
            templatePool = templates.request_failed;
            fallbackMessage = "Hi {name}, there was an issue processing your request for \"{title}\". — Jellyseerr";
            break;
            
        case "ISSUE_CREATED":
            templatePool = templates.issue_created;
            fallbackMessage = "Hi {name}, an issue was reported for \"{title}\" by {username}. — Jellyseerr";
            break;
            
        case "ISSUE_COMMENT":
            templatePool = templates.issue_comment;
            fallbackMessage = "Hi {name}, {username} commented on the issue for \"{title}\". — Jellyseerr";
            break;
            
        case "ISSUE_RESOLVED":
            templatePool = templates.issue_resolved;
            fallbackMessage = "Hi {name}, the issue for \"{title}\" has been resolved. — Jellyseerr";
            break;
            
        case "ISSUE_REOPENED":
            templatePool = templates.issue_reopened;
            fallbackMessage = "Hi {name}, the issue for \"{title}\" has been reopened. — Jellyseerr";
            break;
            
        default:
            log(`No template for event type: ${eventType}`, "warn");
            return null;
    }
    
    // Select template: handle both arrays (multi-variant) and strings (legacy)
    let selectedTemplate = null;
    
    if (Array.isArray(templatePool) && templatePool.length > 0) {
        // Multi-variant: pick random message from pool (avoiding immediate repeats)
        selectedTemplate = pickVariant(templatePool, eventType);
        log(`Selected variant for ${eventType} (pool size: ${templatePool.length})`, "debug");
    } else if (typeof templatePool === 'string') {
        // Legacy: single string template
        selectedTemplate = templatePool;
        log(`Using single template for ${eventType}`, "debug");
    } else {
        // Fallback to default message
        selectedTemplate = fallbackMessage;
        log(`Using fallback template for ${eventType}`, "debug");
    }
    
    if (!selectedTemplate) {
        return null;
    }
    
    // Replace all placeholders
    let message = selectedTemplate;
    for (const [placeholder, value] of Object.entries(replacements)) {
        message = message.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    // Add signature if configured
    const signatures = config.signatures;
    if (signatures && signatures.length > 0) {
        // Random signature selection
        const randomSigIndex = Math.floor(Math.random() * signatures.length);
        const signature = signatures[randomSigIndex];
        message = `${message} ${signature}`;
        log(`Added signature: ${signature}`, "debug");
    }
    
    log(`Generated SMS: "${message}"`, "debug");
    return message;
}

/**
 * Send SMS via TextBee API
 * @param {object} config - TextBee configuration
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - SMS message content
 * @returns {Promise<object>} API response with validated data
 */
async function sendSms(config, phoneNumber, message) {
    const axios = global.get('axios');
    
    if (!axios) {
        throw new Error('axios not available in global context');
    }
    
    const tb = config.textbee;
    const url = `${tb.base_url}${tb.send_path_template.replace('{deviceId}', tb.device_id)}`;
    
    const payload = {
        recipients: [phoneNumber],
        message: message,
        send_at: null, // Send immediately
        sender: tb.default_sender || null
    };
    
    log(`Sending SMS to ${maskPhone(phoneNumber)} via TextBee`, "info");
    log(`TextBee URL: ${url}`, "debug");
    log(`TextBee Payload: ${JSON.stringify(payload)}`, "debug");
    node.trace(`TextBee full request payload: ${JSON.stringify(payload, null, 2)}`);
    
    const response = await axios.post(url, payload, {
        headers: {
            'x-api-key': tb.api_key,
            'Content-Type': 'application/json'
        },
        timeout: tb.timeout_ms || 30000  // Default 30 seconds
    });
    
    // Validate response status code
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`TextBee API returned status ${response.status}: ${JSON.stringify(response.data)}`);
    }
    
    // Log full response for debugging (CRITICAL for troubleshooting)
    log(`TextBee API HTTP Status: ${response.status}`, "info");
    log(`TextBee full response: ${JSON.stringify(response.data)}`, "info");
    log(`TextBee response type: ${typeof response.data}`, "debug");
    log(`TextBee top-level keys: ${Object.keys(response.data || {}).join(', ')}`, "info");
    node.trace(`TextBee raw response: ${JSON.stringify(response.data, null, 2)}`);
    
    // Try multiple response structure patterns
    let responseData = null;
    if (response.data?.data) {
        // Pattern 1: { data: { _id, status, ... } }
        responseData = response.data.data;
        log("Using response.data.data structure", "debug");
        log(`SMS response keys: ${Object.keys(responseData || {}).join(', ')}`, "info");
    } else if (response.data?._id || response.data?.id || response.data?.status) {
        // Pattern 2: { _id, status, ... } (direct structure)
        responseData = response.data;
        log("Using response.data structure", "debug");
    } else if (Array.isArray(response.data) && response.data.length > 0) {
        // Pattern 3: [{ _id, status, ... }] (array)
        responseData = response.data[0];
        log("Using response.data[0] structure", "debug");
    } else {
        // Fallback: use whatever we got
        responseData = response.data;
        log("Using fallback response.data", "debug");
    }
    
    log(`Parsed response data: ${JSON.stringify(responseData)}`, "debug");
    
    // Validate response structure
    if (!responseData) {
        throw new Error('TextBee API returned empty response');
    }
    
    // Extract fields with multiple fallback patterns
    const smsStatus = responseData.status || responseData.state || null;
    const smsId = responseData._id || responseData.id || responseData.messageId || responseData.message_id || responseData.smsBatchId || null;
    const recipients = responseData.recipients || responseData.to || [phoneNumber];
    const messageText = responseData.message || responseData.text || message;
    const createdAt = responseData.createdAt || responseData.created_at || responseData.timestamp || new Date().toISOString();
    
    // TextBee-specific: Infer status from success field and message
    let inferredStatus = smsStatus;
    if (!inferredStatus && responseData.success === true) {
        // TextBee returns success:true with a message instead of status
        if (responseData.message && responseData.message.includes('queue')) {
            inferredStatus = 'QUEUED';
            log(`Inferred status from TextBee response: QUEUED (based on success=true and message="${responseData.message}")`, "debug");
        } else if (responseData.message && responseData.message.includes('sent')) {
            inferredStatus = 'SENT';
            log(`Inferred status from TextBee response: SENT (based on message="${responseData.message}")`, "debug");
        } else {
            inferredStatus = 'ACCEPTED';
            log(`Inferred status from TextBee response: ACCEPTED (based on success=true)`, "debug");
        }
    }
    
    log(`Extracted: status="${inferredStatus}", id="${smsId}", recipients=${JSON.stringify(recipients)}`, "debug");
    
    // If we didn't find standard fields, log everything we got
    if (!inferredStatus && !smsId) {
        log(`⚠️ Could not extract standard fields from response. Full response data:`, "warn");
        log(`Response keys: ${Object.keys(responseData).join(', ')}`, "warn");
        for (const [key, value] of Object.entries(responseData)) {
            log(`  ${key}: ${JSON.stringify(value)}`, "warn");
        }
    }
    
    if (inferredStatus) {
        log(`SMS status: ${inferredStatus} (ID: ${smsId || 'batch'})`, "info");
        
        // Warn on non-optimal statuses but don't fail
        if (inferredStatus === 'FAILED' || inferredStatus === 'ERROR') {
            throw new Error(`TextBee SMS marked as ${inferredStatus} (ID: ${smsId})`);
        } else if (inferredStatus === 'REJECTED') {
            throw new Error(`TextBee SMS was REJECTED (ID: ${smsId})`);
        } else if (inferredStatus === 'PENDING' || inferredStatus === 'QUEUED' || inferredStatus === 'ACCEPTED') {
            log(`SMS queued for delivery (ID: ${smsId})`, "info");
        } else if (inferredStatus === 'SENT' || inferredStatus === 'DELIVERED') {
            log(`SMS ${inferredStatus.toLowerCase()} successfully (ID: ${smsId})`, "info");
        } else {
            log(`SMS has status: ${inferredStatus} (ID: ${smsId})`, "info");
        }
    } else {
        log("No status field found in response", "warn");
    }
    
    return {
        success: true,
        status: inferredStatus || 'UNKNOWN',
        sms_id: smsId,
        recipients: Array.isArray(recipients) ? recipients : [recipients],
        message: messageText,
        created_at: createdAt,
        raw_response: responseData
    };
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

(async () => {
    try {
        node.status({ fill: "blue", shape: "ring", text: "Processing SMS..." });
        
        const payload = msg.payload || {};
        // Normalize event type to uppercase for case-insensitive matching
        const eventType = String(payload.notification_type || payload.event || "").toUpperCase();
        
        log(`Processing event: ${eventType}`);
        
        // Check if this event should trigger SMS
        if (!SMS_EVENTS.includes(eventType)) {
            log(`Event type "${eventType}" not configured for SMS notifications`, "debug");
            node.status({ fill: "grey", shape: "dot", text: "Event not SMS-enabled" });
            return null;
        }
        
        // Load configuration first (needed for squelch window)
        const config = loadConfig();
        if (!config) {
            node.status({ fill: "red", shape: "dot", text: "Config load failed" });
            return null;
        }
        
        // Check for duplicate notifications within squelch window (user-scoped)
        const requestIdRaw = payload.request?.request_id || payload.issue?.id || extractMediaTitle(payload);
        const requesterKeyRaw = (payload.request?.requestedBy_email || payload.request?.requestedBy_username || 
                              payload.issue?.reportedBy_email || payload.issue?.reportedBy_username || "unknown").toLowerCase();
        // Sanitize to prevent invalid characters in context keys (colons, spaces, special chars)
        const requestId = String(requestIdRaw).replace(/[:\s]/g, "_");
        const requesterKey = String(requesterKeyRaw).replace(/[:\s]/g, "_");
        const dedupeKey = `dd:${eventType}:${requestId}:${requesterKey}`;
        const now = Date.now();
        const lastSent = context.get(dedupeKey);
        const squelchMs = config.duplicate_squelch_ms || 60000; // 60 seconds default
        
        if (lastSent && (now - lastSent) < squelchMs) {
            const squelchSecs = Math.round(squelchMs / 1000);
            log(`Squelched duplicate notification within ${squelchMs}ms for ${dedupeKey}`, "info");
            node.status({ fill: "grey", shape: "dot", text: `Duplicate (${squelchSecs}s window)` });
            return null;
        }
        
        // Periodic cleanup of old deduplication keys (every hour)
        const lastCleanup = context.get("last_cleanup") || 0;
        const cleanupInterval = 60 * 60 * 1000; // 1 hour
        
        if ((now - lastCleanup) > cleanupInterval) {
            const allKeys = context.keys();
            const maxAge = (config.duplicate_squelch_ms || 60000) * 2; // 2x squelch window
            let cleaned = 0;
            
            allKeys.forEach(key => {
                // Only clean dedupe keys (prefixed with "dd:")
                if (key.startsWith('dd:')) {
                    const timestamp = context.get(key);
                    if (timestamp && (now - timestamp) > maxAge) {
                        context.set(key, undefined);
                        cleaned++;
                    }
                }
            });
            
            context.set("last_cleanup", now);
            if (cleaned > 0) {
                log(`Cleaned up ${cleaned} expired deduplication keys`, "debug");
            }
        }
        
        // Determine who to notify based on event type
        let targetEmail = null;
        let targetUsername = null;
        
        if (payload.request && (eventType.startsWith("MEDIA_") || eventType === "REQUEST_")) {
            // Request-related events: notify the requester
            targetEmail = payload.request.requestedBy_email;
            targetUsername = payload.request.requestedBy_username;
            log(`Target user from request: ${targetEmail} / ${targetUsername}`, "debug");
            
        } else if (payload.issue && eventType.startsWith("ISSUE_")) {
            // Issue events: notify the issue reporter
            targetEmail = payload.issue.reportedBy_email;
            targetUsername = payload.issue.reportedBy_username;
            log(`Target user from issue: ${targetEmail} / ${targetUsername}`, "debug");
            
        } else if (payload.comment && eventType === "ISSUE_COMMENT") {
            // Comment events: notify the original issue reporter (not the commenter)
            targetEmail = payload.issue?.reportedBy_email;
            targetUsername = payload.issue?.reportedBy_username;
            log(`Target user from issue (comment event): ${targetEmail} / ${targetUsername}`, "debug");
        }
        
        if (!targetEmail && !targetUsername) {
            log("No target user identified in payload", "warn");
            node.status({ fill: "yellow", shape: "dot", text: "No target user" });
            return null;
        }
        
        // Find user in configuration
        const user = findUser(config, targetEmail, targetUsername);
        
        if (!user) {
            log(`User not found in config: ${targetEmail} / ${targetUsername}`, "warn");
            node.status({ fill: "yellow", shape: "dot", text: "User not in config" });
            return null;
        }
        
        // Check user's preferred contact method
        if (user.preferred_contact && user.preferred_contact !== "sms") {
            log(`User ${user.name} prefers ${user.preferred_contact}, skipping SMS`, "info");
            node.status({ fill: "grey", shape: "dot", text: `User prefers ${user.preferred_contact}` });
            return null;
        }
        
        if (!user.phone) {
            log(`User ${user.name} has no phone number configured`, "warn");
            node.status({ fill: "yellow", shape: "dot", text: "No phone number" });
            return null;
        }
        
        // Normalize phone number to E.164 format
        const normalizedPhone = normalizePhone(user.phone);
        if (normalizedPhone !== user.phone) {
            log(`Normalized phone: ${maskPhone(user.phone)} → ${maskPhone(normalizedPhone)}`, "debug");
        } else {
            log(`Phone already normalized: ${maskPhone(normalizedPhone)}`, "debug");
        }
        
        // Generate SMS message
        const message = generateSmsMessage(config, eventType, user, payload);
        
        if (!message) {
            log("Failed to generate SMS message", "warn");
            node.status({ fill: "yellow", shape: "dot", text: "No message template" });
            return null;
        }
        
        // Send SMS via TextBee API
        const result = await sendSms(config, normalizedPhone, message);
        
        // Validate SMS was accepted
        if (!result.success) {
            throw new Error(`SMS send failed: ${result.status}`);
        }
        
        log(`SMS ${result.status} for ${user.name} (${maskPhone(normalizedPhone)}) - ID: ${result.sms_id}`, "info");
        
        // Store timestamp to prevent duplicates
        context.set(dedupeKey, now);
        
        // Track statistics
        const smsCount = (context.get("sms_sent_count") || 0) + 1;
        context.set("sms_sent_count", smsCount);
        log(`Total SMS sent this session: ${smsCount}`, "debug");
        
        // Update node status with SMS status
        // Note: TextBee always returns QUEUED (batch queue system), so we show "Sent" for clarity
        const timestamp = getStatusTimestamp();
        let statusText = `✓ Sent: ${user.name} ${timestamp}`;
        let statusColor = "green";
        
        if (result.status === "UNKNOWN") {
            statusText = `Sent: ${user.name} ${timestamp} (unknown)`;
            statusColor = "yellow";
        }
        
        node.status({ fill: statusColor, shape: "dot", text: statusText });
        
        // Attach result to message for downstream processing
        msg.textbee_result = {
            success: true,
            user: user.name,
            phone: normalizedPhone,
            message: message,
            event: eventType,
            sms_id: result.sms_id,
            sms_status: result.status,
            created_at: result.created_at,
            api_response: result.raw_response
        };
        
        // Send message downstream to next node
        node.send(msg);
        return null;
        
    } catch (err) {
        log(`SMS Handler Error: ${err.message}`, "error");
        node.error(`TextBee SMS Error: ${err.message}`, msg);
        node.status({ fill: "red", shape: "dot", text: `Error: ${err.message}` });
        return null;
        
    } finally {
        node.done();
    }
})();

// Don't return synchronously - handled in async IIFE
return;
