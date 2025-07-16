// Name: Enhanced Tag Scan Processor (Flattened Global Context Version)
// Version: 2.6.0 → 2.7.0
// Date: 2025-07-15
// Note: Make sure this Function node is wired to 4 outputs: [notificationMsg, userCodeMsg, garageAccessMsg, logMsg]
// Changelog v2.7.0: Improved adherence to Node-RED best practices - proper error handling, message preservation, appropriate logging levels

// Load global whitelists and mappings for tags and users
const tagMap  = global.get("tag-whitelist_alarm_cover", "file")  || {};
const userMap = global.get("user-whitelist", "file") || {};
node.log(`Maps loaded: tags=${Object.keys(tagMap).length}, users=${Object.keys(userMap).length}`);

// Returns current timestamp in ISO format
function getTimestamp() {
    return new Date().toISOString();
}

// Finds device name and owner user from device ID by searching through all users
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

// Builds a human-readable details string from provided identifiers
function formatDetails(opts = {}) {
    const { userId, deviceId, tagId, deviceName, tagName } = opts;
    let details = "";
    // Append user info if present
    if (userId) {
        const userName = userMap[userId]?.friendly_name || userId;
        details += `User: ${userName} (${userId})\n`;
    }
    // Append device info if present
    if (deviceId) {
        details += `Device: ${deviceName || deviceId} (${deviceId})\n`;
    }
    // Append tag info if present
    if (tagId) {
        const tName = tagName || tagMap[tagId]?.name || tagId;
        details += `Tag: ${tName} (${tagId})\n`;
    }
    return details.trim();
}

// Constructs either notification or log messages based on type
function buildMsg(type, message, code, level, opts, timestamp, originalMsg = null) {
    const isLog = type === "log";
    // Titles differ for notifications vs logs and severity levels
    const titles = {
        notification: { error: "Scan Error", warn: "Unauthorized Scan", info: "Scan Notice" },
        log:          { error: "Scan Error Log", warn: "Scan Warning Log", info: "Scan Info Log" }
    };
    const key = isLog ? "log" : "data";
    const payload = {
        title:   titles[type][level],            // Human-friendly title
        message: `${message} (${code})`,          // Include error or status code
        details: formatDetails(opts),             // Detailed context
        timestamp                                // When event occurred
    };
    if (isLog) payload.level = level;           // Logs include severity level field
    
    // Preserve original message properties when available (except for log messages)
    if (originalMsg && !isLog) {
        return Object.assign({}, originalMsg, { payload: { [key]: payload } });
    }
    return { payload: { [key]: payload } };
}

try {
    node.log('Processing incoming message');
    node.log(`msg.payload = ${JSON.stringify(msg.payload)}`);
    const ts = getTimestamp();
    node.log(`Timestamp: ${ts}`);

    // Validate payload structure before deconstructing
    if (!msg.payload || typeof msg.payload !== "object") {
        node.error('Invalid payload type detected', msg);
        return [
            buildMsg("notification", "Invalid payload type", "ERR_BAD_PAYLOAD", "error", {}, ts, msg),
            null,
            null,
            buildMsg("log", "Invalid payload type", "ERR_BAD_PAYLOAD", "error", {}, ts)
        ];
    }

    // Extract identifiers from payload
    const { tag_id: tagId, user_id: userId, device_id: deviceId } = msg.payload;
    node.log(`Extracted IDs: tagId=${tagId}, userId=${userId}, deviceId=${deviceId}`);

    // Ensure all required fields are provided
    if (!tagId || !userId || !deviceId) {
        node.error('Missing required fields', msg);
        return [
            buildMsg("notification", "Missing required fields", "ERR_MISSING_FIELDS", "error", { tagId, userId, deviceId }, ts, msg),
            null,
            null,
            buildMsg("log", "Missing required fields", "ERR_MISSING_FIELDS", "error", { tagId, userId, deviceId }, ts)
        ];
    }

    // Lookup tag info; absence means tag not allowed
    const tagInfo = tagMap[tagId];
    if (!tagInfo) {
        node.warn(`Unrecognized tagId: ${tagId}`);
        return [
            buildMsg("notification", "Unrecognized NFC Tag", "ERR_TAG_NOT_ALLOWED", "warn", { tagId, userId, deviceId }, ts, msg),
            null,
            null,
            buildMsg("log", "Unrecognized NFC Tag", "ERR_TAG_NOT_ALLOWED", "warn", { tagId, userId, deviceId }, ts)
        ];
    }

    // Lookup user info; check if user is enabled
    const userInfo = userMap[userId];
    if (!userInfo || !userInfo.enabled) {
        node.warn(`User denied or disabled: ${userId}`);
        return [
            buildMsg("notification", "Unauthorized or disabled user", "ERR_USER_DENIED", "warn", { userId, tagId, deviceId }, ts, msg),
            null,
            null,
            buildMsg("log", "Unauthorized or disabled user", "ERR_USER_DENIED", "warn", { userId, tagId, deviceId }, ts)
        ];
    }

    // Lookup device; absence means scanning from untrusted hardware
    const deviceInfo = findDeviceInfo(deviceId);
    if (!deviceInfo) {
        node.warn(`Unrecognized deviceId: ${deviceId}`);
        return [
            buildMsg("notification", "Unrecognized scanning device", "ERR_DEVICE_NOT_ALLOWED", "warn", { deviceId, userId, tagId }, ts, msg),
            null,
            null,
            buildMsg("log", "Unrecognized scanning device", "ERR_DEVICE_NOT_ALLOWED", "warn", { deviceId, userId, tagId }, ts)
        ];
    }

    const { deviceName, deviceOwner, deviceOwnerId } = deviceInfo;

    // All checks passed: build success notification and outputs
    node.log(`Authorized scan: tag=${tagId}, user=${userId}, device=${deviceId} (owned by ${deviceOwner})`);
    
    // First output: notification message (preserves original msg properties)
    const authorizedNote = Object.assign({}, msg, {
        payload: {
            data: {
                title:     "Authorized Tag Scan",
                message:   `${tagInfo.name} tag scanned by ${userInfo.friendly_name} using ${deviceName}`,
                // Provide detailed context for UIs or logs
                details:   formatDetails({ userId, deviceId, tagId, deviceName, tagName: tagInfo.name }),
                timestamp: ts
            },
            icon:     userInfo.entity_picture,
            tag_name: tagInfo.name,
            user_name:userInfo.friendly_name
        }
    });

    // Second output: user code for alarm control (conditional based on tag permissions)
    const userCodeMsg = tagInfo.alarm_control
        ? { payload: userInfo.user_code }
        : null;
    
    // Third output: optional garage access command if allowed by tag (new message)
    const garageAccessMsg = tagInfo.garage_access
        ? { payload: { command: "open_garage", tag: tagInfo.name, user: userInfo.user_code } }
        : null;
        
    // Fourth output: audit log entry (new message)
    const logMsg = buildMsg("log", "Authorized Tag Scan", "OK", "info", { userId, tagId, deviceId, deviceName, tagName: tagInfo.name }, ts);

    return [authorizedNote, userCodeMsg, garageAccessMsg, logMsg];
} catch (err) {
    // Catch-all error handler: notify and log internal errors
    node.error(`Error caught: ${err.message}`, msg);
    const ts2 = getTimestamp();
    return [
        buildMsg("notification", "Internal error", "ERR_INTERNAL", "error", {}, ts2, msg),
        null,
        null,
        buildMsg("log", err.message, "ERR_INTERNAL", "error", {}, ts2)
    ];
}
