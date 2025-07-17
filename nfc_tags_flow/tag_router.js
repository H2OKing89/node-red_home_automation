/**
 * Node-RED Function: Tag Router
 * Version: 1.1.0
 * Date: 2025-07-16
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

// Log loaded categories for debugging
const categoryCounts = Object.entries(tagCategories).map(([category, tags]) => 
    `${category}=${Object.keys(tags).length}`
).join(', ');
node.log(`Tag categories loaded: ${categoryCounts}`);
node.log(`User whitelist loaded: ${Object.keys(userMap).length} users`);

/**
 * Determine which category a tag belongs to
 * @param {string} tagId - The tag ID to categorize
 * @returns {string|null} Category name or null if uncategorized
 */
function categorizeTag(tagId) {
    for (const [categoryName, categoryTags] of Object.entries(tagCategories)) {
        if (categoryTags[tagId]) {
            return categoryName;
        }
    }
    return null; // Uncategorized
}

/**
 * Find device information from device ID
 * @param {string} deviceId - The device ID to lookup
 * @returns {object|null} Device info or null if not found
 */
function findDeviceInfo(deviceId) {
    for (const [userId, userInfo] of Object.entries(userMap)) {
        if (userInfo.device_id && userInfo.device_id[deviceId]) {
            return {
                deviceName: userInfo.device_id[deviceId],
                deviceOwner: userInfo.friendly_name,
                deviceOwnerId: userId
            };
        }
    }
    return null;
}

/**
 * Build notification message for uncategorized tags (formatted for notify_pushover.js)
 * @param {object} originalMsg - Original message object
 * @param {string} tagId - Tag ID
 * @param {string} userId - User ID
 * @param {string} deviceId - Device ID
 * @param {string} tagName - Tag name from payload
 * @param {boolean} isSuccess - Whether this is a successful scan or error
 * @param {string} errorType - Type of error if not successful
 * @returns {object} Formatted message for pushover notification
 */
function buildUncategorizedNotification(originalMsg, tagId, userId, deviceId, tagName, isSuccess = true, errorType = null) {
    const timestamp = new Date().toISOString();
    
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
    
    // Create message structure compatible with notify_pushover.js
    return Object.assign({}, originalMsg, {
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
    });
}

try {
    // Validate message structure
    if (!msg || typeof msg !== 'object') {
        node.error('[tag_router] Invalid message object', msg);
        // Return error notification to output 1, consistent with other error handling
        const errorMsg = {
            payload: {
                data: {
                    title: "Tag Router Error",
                    message: "Invalid message object received",
                    details: "Message is not a valid object",
                    timestamp: new Date().toISOString()
                },
                tag_name: "Error",
                user_name: "System"
            }
        };
        return [errorMsg, null];
    }

    // Validate payload structure
    if (!msg.payload || typeof msg.payload !== 'object') {
        node.error('[tag_router] Invalid payload structure', msg);
        const errorMsg = Object.assign({}, msg, {
            payload: {
                data: {
                    title: "Tag Router Error",
                    message: "Invalid payload structure",
                    details: "Payload is missing or not an object",
                    timestamp: new Date().toISOString()
                },
                tag_name: "Error",
                user_name: "System"
            }
        });
        return [errorMsg, null];
    }

    // Extract tag_id from payload
    const { tag_id: tagId, user_id: userId, device_id: deviceId, name: tagName } = msg.payload;
    
    // Validate required fields
    if (!tagId) {
        node.error('[tag_router] Missing tag_id in payload', msg);
        const errorMsg = Object.assign({}, msg, {
            payload: {
                data: {
                    title: "Tag Router Error", 
                    message: "Missing required tag_id field",
                    details: `Received payload: ${JSON.stringify(msg.payload)}`,
                    timestamp: new Date().toISOString()
                },
                tag_name: "Error",
                user_name: "System"
            }
        });
        return [errorMsg, null];
    }

    // Validate user_id and device_id are also present for proper validation
    if (!userId || !deviceId) {
        node.error('[tag_router] Missing user_id or device_id in payload', msg);
        const errorMsg = buildUncategorizedNotification(msg, tagId, userId, deviceId, tagName, false, 'missing_fields');
        return [errorMsg, null];
    }

    node.log(`[tag_router] Processing tag scan: ${tagId} (${tagName || 'unknown name'})`);

    // Determine category
    const category = categorizeTag(tagId);
    
    if (category) {
        node.log(`[tag_router] Tag ${tagId} belongs to category: ${category}`);
        
        // For categorized tags, create a notification message for output 1
        const timestamp = new Date().toISOString();
        const userInfo = userMap[userId];
        const deviceInfo = findDeviceInfo(deviceId);
        const tagInfo = tagCategories[category][tagId];
        
        const notificationMsg = Object.assign({}, msg, {
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
                    timestamp: timestamp
                },
                icon: userInfo?.entity_picture,
                tag_name: tagInfo?.name || tagId,
                user_name: userInfo?.friendly_name || userId
            }
        });
        
        // Send notification to output 1 AND original message to category output 2
        return [notificationMsg, msg];
    } else {
        node.warn(`[tag_router] Tag ${tagId} is uncategorized - validating scan`);
        
        // For uncategorized tags, we need to validate user and device like alarm_cover_processor does
        
        // Lookup user info; check if user is enabled
        const userInfo = userMap[userId];
        if (!userInfo || !userInfo.enabled) {
            node.warn(`[tag_router] User denied or disabled: ${userId}`);
            const errorMsg = buildUncategorizedNotification(msg, tagId, userId, deviceId, tagName, false, 'user_denied');
            return [errorMsg, null];
        }
        
        // Lookup device; absence means scanning from untrusted hardware
        const deviceInfo = findDeviceInfo(deviceId);
        if (!deviceInfo) {
            node.warn(`[tag_router] Unrecognized deviceId: ${deviceId}`);
            const errorMsg = buildUncategorizedNotification(msg, tagId, userId, deviceId, tagName, false, 'device_denied');
            return [errorMsg, null];
        }
        
        // All validations passed: build success notification for uncategorized tag
        node.log(`[tag_router] Valid uncategorized scan: tag=${tagId}, user=${userId}, device=${deviceId}`);
        const successMsg = buildUncategorizedNotification(msg, tagId, userId, deviceId, tagName, true);
        return [successMsg, null];
    }

} catch (err) {
    node.error(`[tag_router] Exception in router: ${err.message}`, msg);
    // Send error to uncategorized output with basic notification structure
    const errorMsg = Object.assign({}, msg, {
        payload: {
            data: {
                title: "Tag Router Error",
                message: `Error processing tag scan: ${err.message}`,
                details: `Original payload: ${JSON.stringify(msg.payload)}`,
                timestamp: new Date().toISOString()
            },
            tag_name: "Error",
            user_name: "System"
        }
    });
    return [errorMsg, null];
}