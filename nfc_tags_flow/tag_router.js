/**
 * Node-RED Function: Tag Router
 * Version: 1.3.0
 * Date: 2025-07-30
 * Description: Routes NFC tag scans to appropriate handlers based on tag category
 * 
 * Outputs:
 * 1. All notifications (formatted for pushover) - receives both categorized and uncategorized notifications
 * 2. Categorized tags only (raw messages) - receives original messages for specific category processors
 * 
 * Message Flow:
 * - Uncategorized tags: Validated → Output 1 (notification only)
 * - Categorized tags: Notification → Output 1, Original → Output 2 
 * 
 * Changelog:
 * v1.0.0: Initial version with alarm_cover category support
 * v1.1.0: Improved error handling, consistent message formatting for pushover compatibility
 * v1.2.0: Performance and reliability improvements:
 *         - Fixed categorizeTag truthiness trap using hasOwnProperty
 *         - Added O(1) device lookup via deviceIndex
 *         - Centralized error notification builder
 *         - Added node status indicators for better debugging
 *         - Deep clone messages to prevent mutation issues
 * v1.2.1: Consistency and robustness improvements:
 *         - Single timestamp per scan for consistent log correlation
 *         - Added type validation for tagId, userId, deviceId fields
 *         - Enhanced error message for invalid data types
 * v1.3.0: Production hardening and performance optimization:
 *         - CRITICAL: Fixed Object.assign crash when msg is null/non-object
 *         - Cached device index with smart rebuild detection
 *         - Moved verbose logging to debug level to reduce noise
 *         - Added whitespace trimming and empty-after-trim validation
 *         - Minimal notification objects (no msg payload leakage)
 *         - Safe payload redaction in error messages
 *         - Warm-up state detection for empty user maps
 */

// Load global whitelists for different tag categories
const tagCategories = {
    alarm_cover: global.get("tag-whitelist_alarm_cover", "file") || {}
    // Future categories can be added here:
    // security: global.get("tag-whitelist_security", "file") || {},
    // maintenance: global.get("tag-whitelist_maintenance", "file") || {}
};

// Load user whitelist for building notification messages
const userMap = global.get("user-whitelist", "file") || {};

// Get cached device index or rebuild if needed
let deviceIndex = context.get('deviceIndex') || {};
const userMapSize = Object.keys(userMap).length;
const cachedUserMapSize = context.get('userMapSize') || 0;

// Rebuild device index if user map has changed
if (userMapSize !== cachedUserMapSize || Object.keys(deviceIndex).length === 0) {
    node.debug('[tag_router] Rebuilding device index - user map changed or cache empty');
    deviceIndex = {};
    for (const [userId, userInfo] of Object.entries(userMap)) {
        if (userInfo.device_id) {
            for (const [deviceId, deviceName] of Object.entries(userInfo.device_id)) {
                deviceIndex[deviceId] = {
                    deviceName: deviceName,
                    deviceOwner: userInfo.friendly_name,
                    deviceOwnerId: userId
                };
            }
        }
    }
    // Cache the rebuilt index and size
    context.set('deviceIndex', deviceIndex);
    context.set('userMapSize', userMapSize);
    
    // Log rebuild stats (debug level to reduce noise)
    const categoryCounts = Object.entries(tagCategories).map(([category, tags]) => 
        `${category}=${Object.keys(tags).length}`
    ).join(', ');
    node.debug(`[tag_router] Device index rebuilt: ${Object.keys(deviceIndex).length} devices from ${userMapSize} users`);
    node.debug(`[tag_router] Tag categories: ${categoryCounts}`);
} else {
    node.debug('[tag_router] Using cached device index');
}

// Warm-up state detection
if (userMapSize === 0 || Object.keys(deviceIndex).length === 0) {
    node.status({fill:"grey", shape:"ring", text:"warming up"});
    node.warn('[tag_router] Empty user map or device index - system may be warming up');
}

/**
 * Determine which category a tag belongs to
 * @param {string} tagId - The tag ID to categorize
 * @returns {string|null} Category name or null if uncategorized
 */
function categorizeTag(tagId) {
    for (const [categoryName, categoryTags] of Object.entries(tagCategories)) {
        if (Object.prototype.hasOwnProperty.call(categoryTags, tagId)) {
            return categoryName;
        }
    }
    return null; // Uncategorized
}

/**
 * Safely redact potentially sensitive payload for error logging
 * @param {object} payload - Payload to redact
 * @returns {string} Safe payload string
 */
function redactPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return String(payload);
    }
    
    const safe = { ...payload };
    // Redact potentially sensitive fields but keep structure visible
    if (safe.password) safe.password = '[REDACTED]';
    if (safe.token) safe.token = '[REDACTED]';
    if (safe.key) safe.key = '[REDACTED]';
    
    const payloadStr = JSON.stringify(safe);
    // Truncate very long payloads
    return payloadStr.length > 500 ? payloadStr.substring(0, 500) + '...[TRUNCATED]' : payloadStr;
}

/**
 * Find device information from device ID (O(1) lookup)
 * @param {string} deviceId - The device ID to lookup
 * @returns {object|null} Device info or null if not found
 */
function findDeviceInfo(deviceId) {
    return deviceIndex[deviceId] || null;
}

/**
 * Build system error notification for router errors
 * @param {object} originalMsg - Original message object (may be null/invalid)
 * @param {string} errorType - Type of system error
 * @param {string} details - Error details
 * @param {string} timestamp - ISO timestamp for consistency
 * @returns {object} Formatted error message
 */
function buildSystemErrorNotification(originalMsg, errorType, details, timestamp) {
    const errorMessages = {
        'invalid_message': 'Invalid message object received',
        'invalid_payload': 'Invalid payload structure',
        'missing_tag_id': 'Missing required tag_id field',
        'invalid_types': 'Invalid data types in payload fields',
        'exception': 'Error processing tag scan'
    };
    
    // Safe merge - don't merge if originalMsg is null/undefined/non-object
    const baseMsg = (originalMsg && typeof originalMsg === 'object') ? originalMsg : {};
    
    return Object.assign({}, baseMsg, {
        payload: {
            data: {
                title: "Tag Router Error",
                message: errorMessages[errorType] || 'Unknown router error',
                details: details,
                timestamp: timestamp
            },
            tag_name: "Error",
            user_name: "System"
        }
    });
}

/**
 * Build notification message for uncategorized tags (formatted for notify_pushover.js)
 * @param {object} originalMsg - Original message object
 * @param {string} tagId - Tag ID
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @param {string} tagName - Tag name from payload
 * @param {string} timestamp - ISO timestamp for consistency
 * @param {boolean} isSuccess - Whether this is a successful scan or error
 * @param {string} errorType - Type of error if not successful
 * @returns {object} Formatted message for pushover notification
 */
function buildUncategorizedNotification(originalMsg, tagId, userId, deviceId, tagName, timestamp, isSuccess = true, errorType = null) {
    // Get user info
    const userInfo = userMap[userId];
    const userName = userInfo?.friendly_name || "Unknown User";
    const userPicture = userInfo?.entity_picture || null;
    
    // Get device info
    const deviceInfo = findDeviceInfo(deviceId);
    const deviceName = deviceInfo?.deviceName || deviceId;
    
    // Build details string
    const details = [
        `User: ${userName} (${userId})`,
        `Device: ${deviceName} (${deviceId})`,
        `Tag: ${tagName || tagId} (${tagId})`
    ].join('\n');
    
    let title, message;
    
    if (isSuccess) {
        title = "Uncategorized Tag Scan";
        message = `Uncategorized tag "${tagName || tagId}" scanned by ${userName} using ${deviceName}`;
    } else {
        // Error cases
        const errorMessages = {
            'user_denied': 'Unauthorized or disabled user attempted scan',
            'device_denied': 'Scan from unrecognized device',
            'missing_fields': 'Invalid scan data received'
        };
        title = "Unauthorized Scan";
        message = errorMessages[errorType] || 'Scan error occurred';
    }
    
    // Create minimal message structure compatible with notify_pushover.js
    return {
        _msgid: originalMsg?._msgid, // Preserve message ID for tracing if available
        payload: {
            data: {
                title: title,
                message: message,
                details: details,
                timestamp: timestamp
            },
            icon: userPicture,
            tag_name: tagName || tagId,
            user_name: userName
        }
    };
}

try {
    // Create single timestamp for this scan to ensure consistency across all messages
    const now = new Date().toISOString();
    
    // Validate message structure
    if (!msg || typeof msg !== 'object') {
        node.error('[tag_router] Invalid message object', msg);
        node.status({fill:"red", shape:"dot", text:"invalid message"});
        const errorMsg = buildSystemErrorNotification(msg, 'invalid_message', "Message is not a valid object", now);
        return [errorMsg, null];
    }

    // Validate payload structure
    if (!msg.payload || typeof msg.payload !== 'object') {
        node.error('[tag_router] Invalid payload structure', msg);
        node.status({fill:"red", shape:"dot", text:"invalid payload"});
        const errorMsg = buildSystemErrorNotification(msg, 'invalid_payload', "Payload is missing or not an object", now);
        return [errorMsg, null];
    }

    // Extract and trim tag_id from payload
    const { tag_id: rawTagId, user_id: rawUserId, device_id: rawDeviceId, name: tagName } = msg.payload;
    
    // Validate required fields exist
    if (!rawTagId) {
        node.error('[tag_router] Missing tag_id in payload', msg);
        node.status({fill:"red", shape:"dot", text:"missing tag_id"});
        const errorMsg = buildSystemErrorNotification(msg, 'missing_tag_id', `Received payload: ${redactPayload(msg.payload)}`, now);
        return [errorMsg, null];
    }

    // Validate user_id and device_id are present
    if (!rawUserId || !rawDeviceId) {
        node.error('[tag_router] Missing user_id or device_id in payload', msg);
        node.status({fill:"red", shape:"dot", text:"missing fields"});
        const errorMsg = buildUncategorizedNotification(msg, rawTagId, rawUserId, rawDeviceId, tagName, now, false, 'missing_fields');
        return [errorMsg, null];
    }
    
    // Type validation - ensure critical fields are strings
    if (typeof rawTagId !== 'string' || typeof rawUserId !== 'string' || typeof rawDeviceId !== 'string') {
        node.error('[tag_router] Invalid field types - tagId, userId, deviceId must be strings', msg);
        node.status({fill:"red", shape:"dot", text:"invalid types"});
        const errorMsg = buildSystemErrorNotification(msg, 'invalid_types', 
            `Field types: tagId=${typeof rawTagId}, userId=${typeof rawUserId}, deviceId=${typeof rawDeviceId}. All must be strings.`, now);
        return [errorMsg, null];
    }
    
    // Trim whitespace and validate not empty after trimming
    const tagId = rawTagId.trim();
    const userId = rawUserId.trim();
    const deviceId = rawDeviceId.trim();
    
    if (!tagId || !userId || !deviceId) {
        node.error('[tag_router] Empty fields after trimming whitespace', msg);
        node.status({fill:"red", shape:"dot", text:"empty fields"});
        const errorMsg = buildSystemErrorNotification(msg, 'invalid_types', 
            `Fields empty after trim: tagId="${tagId}", userId="${userId}", deviceId="${deviceId}"`, now);
        return [errorMsg, null];
    }

    node.log(`[tag_router] Processing tag scan: ${tagId} (${tagName || 'unknown name'})`);

    // Determine category
    const category = categorizeTag(tagId);
    
    if (category) {
        node.log(`[tag_router] Tag ${tagId} belongs to category: ${category}`);
        node.status({fill:"green", shape:"dot", text:`${category} OK`});
        
        // For categorized tags, create a minimal notification message for output 1
        const userInfo = userMap[userId];
        const deviceInfo = findDeviceInfo(deviceId);
        const tagInfo = tagCategories[category][tagId];
        
        const notificationMsg = {
            _msgid: msg._msgid, // Preserve message ID for tracing
            payload: {
                data: {
                    title: "Categorized Tag Scan",
                    message: `${tagInfo?.name || tagId} tag (${category}) scanned by ${userInfo?.friendly_name || userId}`,
                    details: [
                        `User: ${userInfo?.friendly_name || userId} (${userId})`,
                        `Device: ${deviceInfo?.deviceName || deviceId} (${deviceId})`,
                        `Tag: ${tagInfo?.name || tagId} (${tagId})`,
                        `Category: ${category}`
                    ].join('\n'),
                    timestamp: now
                },
                icon: userInfo?.entity_picture,
                tag_name: tagInfo?.name || tagId,
                user_name: userInfo?.friendly_name || userId
            }
        };
        
        // Send notification to output 1 AND original message to category output 2
        // Use deep clone to prevent potential mutation issues
        return [notificationMsg, RED.util.cloneMessage(msg)];
    } else {
        node.warn(`[tag_router] Tag ${tagId} is uncategorized - validating scan`);
        
        // For uncategorized tags, we need to validate user and device like alarm_cover_processor does
        
        // Lookup user info; check if user is enabled
        const userInfo = userMap[userId];
        if (!userInfo || !userInfo.enabled) {
            node.warn(`[tag_router] User denied or disabled: ${userId}`);
            node.status({fill:"yellow", shape:"dot", text:"user denied"});
            const errorMsg = buildUncategorizedNotification(msg, tagId, userId, deviceId, tagName, now, false, 'user_denied');
            return [errorMsg, null];
        }
        
        // Lookup device; absence means scanning from untrusted hardware
        const deviceInfo = findDeviceInfo(deviceId);
        if (!deviceInfo) {
            node.warn(`[tag_router] Unrecognized deviceId: ${deviceId}`);
            node.status({fill:"yellow", shape:"dot", text:"device denied"});
            const errorMsg = buildUncategorizedNotification(msg, tagId, userId, deviceId, tagName, now, false, 'device_denied');
            return [errorMsg, null];
        }
        
        // All validations passed: build success notification for uncategorized tag
        node.log(`[tag_router] Valid uncategorized scan: tag=${tagId}, user=${userId}, device=${deviceId}`);
        node.status({fill:"green", shape:"dot", text:"uncat OK"});
        const successMsg = buildUncategorizedNotification(msg, tagId, userId, deviceId, tagName, now, true);
        return [successMsg, null];
    }

} catch (err) {
    node.error(`[tag_router] Exception in router: ${err.message}`, msg);
    node.status({fill:"red", shape:"dot", text:"exception"});
    // Use a fresh timestamp for exceptions since 'now' might not be available
    const exceptionTime = new Date().toISOString();
    const errorMsg = buildSystemErrorNotification(msg, 'exception', `${err.message}. Original payload: ${redactPayload(msg?.payload)}`, exceptionTime);
    return [errorMsg, null];
}