/**
 * Script Name: HA User ID and Name to Alarm Code Matching and Disarm Action (Enhanced, V2.3.0)
 * Platform: Node-RED
 * Flow: Home Security System
 * Group: Alarm Deactivation Management
 * Date: 2025-06-21
 * Version: 2.3.0
 * Author: Quentin King
 *
 * Description:
 * This script processes incoming Home Assistant event payloads and dispatches a disarm action if a valid user
 * is recognized. It supports both Home Assistant user ID and user name matching, using the user-whitelist 
 * as a single source of truth. The script constructs a disarm action payload for the alarm system.
 *
 * Patch Notes:
 * - Version 2.2.0 (2025-02-12): Modified the success output so that msg.payload is identical to version 1.7.1.
 * - Version 2.2.1 (2025-02-12): Added additional comments about the outgoing payload format and made minor improvements.
 * - Version 2.3.0 (2025-06-21): Enhanced to support Home Assistant user IDs, uses user-whitelist as source of truth,
 *   improved user lookup with dual-mode support for both HA user ID and name-based lookups.
 *
 * Expected Incoming Message Payload Structure:
 * {
 *   "topic": "input_text.garage_deadbolt_status",
 *   "payload": "Unlocked by Dan Bienka",
 *   "data": {
 *      "event_type": "state_changed",
 *      "entity_id": "input_text.garage_deadbolt_status",
 *      "event": {
 *         "entity_id": "input_text.garage_deadbolt_status",
 *         "old_state": { ... },
 *         "new_state": {
 *            "entity_id": "input_text.garage_deadbolt_status",
 *            "state": "Unlocked by Dan Bienka",
 *            "attributes": { ... }
 *         }
 *      },
 *      "origin": "LOCAL",
 *      "time_fired": "2025-02-13T04:29:56.908848+00:00",
 *      "context": { ... }
 *   },
 *   "_msgid": "unique_message_id"
 * }
 *
 * IMPORTANT: Outgoing Message Payload Format
 * -------------------------------------------
 * For a successful disarm action, the outgoing message MUST have a payload in the EXACT format below:
 *
 * {
 *   action: "alarmo.disarm",
 *   data: {
 *     code: <ALARM_CODE>,            // e.g., "9482"
 *     entity_id: "alarm_control_panel.alarmo"
 *   }
 * }
 *
 * Any deviation (e.g., additional nesting or extra keys) WILL break compatibility with the Home Assistant node.
 * * Note: The script extracts the state from msg.data.event.new_state.state, which can be in either format:
 * - "Unlocked by [HA_USER_ID] User Name" (preferred - uses HA user ID for reliable lookup)
 * - "Unlocked by User Name" (legacy - falls back to name-based lookup)
 * 
 * The script uses the global user-whitelist as the single source of truth for user data and alarm codes.
 */

// Fallback alarm code if a user-specific code isn't found.
const FALLBACK_ALARM_CODE = env.get('FALLBACK_ALARM_CODE') || "1437";

// Non-user sources that bypass disarm actions (e.g., RF or manual unlocks).
const NON_USER_SOURCES = env.get('NON_USER_SOURCES')
    ? env.get('NON_USER_SOURCES').split(',').map(source => source.trim().toLowerCase())
    : ['rf', 'manual'];

// Alarm entity ID used for disarming actions.
const ALARM_ENTITY_ID = context.get('alarmEntityId') || 'alarm_control_panel.alarmo';

// Regex for parsing the state string from the event payload.
// Expected to match patterns like:
// - "Unlocked by [2e64d5e38cab42a08ea8a3a15d2713f0] Quentin King"
// - "Unlocked by Dan Bienka"
// - "Locked by [MANUAL] Manual"
const EVENT_STATE_REGEX = env.get('EVENT_STATE_REGEX')
    ? new RegExp(env.get('EVENT_STATE_REGEX'))
    : /(\w+)(?:\s+by\s+(.+))?/i;

// Regex for validating alarm codes; default expects at least 4 digits.
const ALARM_CODE_REGEX_STRING = env.get('ALARM_CODE_REGEX') || '^\\d{4,}$';
const ALARM_CODE_REGEX = new RegExp(ALARM_CODE_REGEX_STRING);

/**
 * Logs messages at the specified severity level.
 * Only outputs logs if context.debugging is true.
 *
 * @param {string} level - Log level ('DEBUG', 'INFO', 'WARN', 'ERROR').
 * @param {string} message - The log message.
 * @param {object} additionalContext - Optional additional context.
 */
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO; // Change to INFO or WARN for less verbosity

class Logger {
    constructor(level = DEFAULT_LOG_LEVEL) {
        this.level = level;
    }
    log(level, message, context = {}) {
        if (LOG_LEVELS[level] < this.level) return;
        const timestamp = new Date().toISOString();
        let logEntry = `[${timestamp}] [${level}] ${message}`;
        if (Object.keys(context).length > 0) {
            logEntry += ` ${JSON.stringify(context)}`;
        }
        switch (level) {
            case 'DEBUG': case 'INFO': node.log(logEntry); break;
            case 'WARN': node.warn(logEntry); break;
            case 'ERROR': node.error(logEntry); break;
            default: node.log(logEntry);
        }
    }
    debug(msg, ctx) { this.log('DEBUG', msg, ctx); }
    info(msg, ctx) { this.log('INFO', msg, ctx); }
    warn(msg, ctx) { this.log('WARN', msg, ctx); }
    error(msg, ctx) { this.log('ERROR', msg, ctx); }
}

// Usage:
const logger = new Logger(LOG_LEVELS.DEBUG); // or set from env/context

/**
 * Validates critical configuration parameters.
 * Throws an error if any configuration is invalid.
 */
function validateConfiguration() {
    let valid = true;
    if (typeof ALARM_ENTITY_ID !== 'string' || ALARM_ENTITY_ID.trim() === '') {
        logger.error('Invalid ALARM_ENTITY_ID configuration.');
        valid = false;
    }
    if (!Array.isArray(NON_USER_SOURCES)) {
        logger.error('NON_USER_SOURCES must be an array.');
        valid = false;
    }
    if (!(EVENT_STATE_REGEX instanceof RegExp)) {
        logger.error('EVENT_STATE_REGEX is not a valid RegExp.');
        valid = false;
    }
    if (!(ALARM_CODE_REGEX instanceof RegExp)) {
        logger.error('ALARM_CODE_REGEX is not a valid RegExp.');
        valid = false;
    }
    if (!valid) {
        throw new Error('Configuration validation failed.');
    }
}

/**
 * Parses the event state string from the payload.
 *
 * @param {string} state - The state string from msg.data.event.new_state.state.
 * @returns {object} - An object containing 'action' and 'source' extracted from the state.
 * @throws {Error} - If the state cannot be parsed.
 */
function parseEventState(state) {
    const match = state.match(EVENT_STATE_REGEX);
    if (!match) {
        throw new Error(`Failed to parse state using regex ${EVENT_STATE_REGEX}: ${state}`);
    }
    const action = match[1].toLowerCase();
    const source = match[2] ? match[2].trim().toLowerCase() : "unknown";
    return { action, source };
}

/**
 * Sanitizes the user name to ensure only allowed characters are used.
 *
 * @param {string} name - The user name extracted from the event payload.
 * @returns {string} - The sanitized user name.
 * @throws {Error} - If the sanitized name exceeds 50 characters.
 */
function sanitizeUserName(name) {
    // Allowed characters: letters, numbers, underscores, hyphens, apostrophes, dots, and spaces.
    const sanitized = name.replace(/[^\w\s\-'.]/gi, '').trim().toLowerCase();
    if (sanitized.length > 50) {
        throw new Error('User name exceeds maximum allowed length.');
    }
    return sanitized;
}

/**
 * Extracts Home Assistant user ID and user name from the source string.
 * Handles both formats:
 * - "[2e64d5e38cab42a08ea8a3a15d2713f0] Quentin King" (with HA user ID)
 * - "Quentin King" (without HA user ID)
 *
 * @param {string} source - The source string from the event payload.
 * @returns {object} - An object containing 'haUserId' and 'userName'.
 */
function parseUserSource(source) {
    // Regex to match HA user ID format: [32-character hex] followed by optional name
    const haUserIdMatch = source.match(/^\[([a-f0-9]{32})\](?:\s+(.+))?$/i);
    
    if (haUserIdMatch) {
        return {
            haUserId: haUserIdMatch[1].toLowerCase(),
            userName: haUserIdMatch[2] ? haUserIdMatch[2].trim().toLowerCase() : null
        };
    } else {
        // No HA user ID found, treat entire source as user name
        return {
            haUserId: null,
            userName: source.trim().toLowerCase()
        };
    }
}

/**
 * Looks up the alarm code for a given user using HA user ID.
 * Simplified to only use HA user ID lookup for reliability.
 *
 * @param {string} haUserId - The Home Assistant user ID.
 * @param {Map} userCodesByHAId - Map of HA user IDs to alarm codes.
 * @returns {string} - The valid alarm code.
 * @throws {Error} - If the alarm code format is invalid.
 */
function lookupAlarmCodeByHAId(haUserId, userCodesByHAId) {
    let alarmCode = null;
    let lookupMethod = '';
    
    // Try HA user ID lookup (primary method)
    if (haUserId && userCodesByHAId.has(haUserId)) {
        alarmCode = userCodesByHAId.get(haUserId);
        lookupMethod = `HA user ID "${haUserId}"`;
    }
    
    if (!alarmCode) {
        logger.warn(`Alarm code not found for HA ID "${haUserId}", using fallback code.`);
        alarmCode = FALLBACK_ALARM_CODE;
        lookupMethod = 'fallback';
    } else {
        logger.debug(`Found alarm code via ${lookupMethod}`);
    }
    
    alarmCode = String(alarmCode);
    if (!ALARM_CODE_REGEX.test(alarmCode)) {
        throw new Error(`Invalid alarm code format for HA ID "${haUserId}". Alarm code: ${alarmCode}`);
    }
    
    return alarmCode;
}

/**
 * Sends a success message on output #1.
 *
 * IMPORTANT: Outgoing Message Payload Format
 * -----------------------------------------------------------
 * The outgoing message MUST have its payload set exactly as follows (to be compatible with
 * the Home Assistant node):
 *
 * {
 *   action: "alarmo.disarm",
 *   data: {
 *     code: <ALARM_CODE>,
 *     entity_id: "alarm_control_panel.alarmo"
 *   }
 * }
 *
 * Any changes to this structure (e.g., additional nesting or extra keys) will break the integration.
 *
 * @param {object} msg - The original message object.
 * @param {object} outputPayload - The payload to send, which must match the above structure.
 */
function sendSuccess(msg, outputPayload) {
    // Set the payload exactly as required (no extra nesting).
    msg.payload = outputPayload;
    node.send([msg, null]);
}

/**
 * Sends an error message on output #2.
 *
 * @param {object} originalMsg - The original message object.
 * @param {object} errorObj - The error details.
 */
function sendError(originalMsg, errorObj) {
    originalMsg.payload = errorObj;
    node.send([null, originalMsg]);
}

/**
 * Main async function that processes the incoming message payload.
 * * Expected Incoming Payload Example (with HA user ID - preferred format):
 *
 * {
 *   "topic": "input_text.garage_deadbolt_status",
 *   "payload": "Unlocked by [2e64d5e38cab42a08ea8a3a15d2713f0] Quentin King",
 *   "data": {
 *      "event_type": "state_changed",
 *      "entity_id": "input_text.garage_deadbolt_status",
 *      "event": {
 *         "entity_id": "input_text.garage_deadbolt_status",
 *         "old_state": { ... },
 *         "new_state": {
 *            "entity_id": "input_text.garage_deadbolt_status",
 *            "state": "Unlocked by [2e64d5e38cab42a08ea8a3a15d2713f0] Quentin King",
 *            "attributes": { ... }
 *         }
 *      },
 *      "origin": "LOCAL",
 *      "time_fired": "2025-06-21T04:29:56.908848+00:00",
 *      "context": { ... }
 *   },
 *   "_msgid": "unique_message_id"
 * }
 *
 * Legacy Format (backward compatibility):
 * {
 *   "payload": "Unlocked by Dan Bienka",
 *   "data": { "event": { "new_state": { "state": "Unlocked by Dan Bienka" } } }
 * }
 *
 * Note: The script extracts the state from msg.data.event.new_state.state,
 * which must be in the format "Unlocked by [User Name]".
 */
(async () => {
    try {
        logger.debug('Function node initialized and running.');        // Validate configuration before processing.
        validateConfiguration();
          // Load global user-whitelist (centralized source of truth) and create lookup maps.
        const userWhitelist = global.get('user-whitelist', 'file') || {};
        logger.debug('Loaded user-whitelist:', userWhitelist);
        logger.debug('user-whitelist type:', typeof userWhitelist);
        logger.debug('user-whitelist keys:', Object.keys(userWhitelist));
          // Create a simple map of HA user ID to user_code (primary and only lookup method)
        const userCodesByHAId = new Map();
        
        Object.entries(userWhitelist).forEach(([haUserId, user]) => {
            logger.debug(`Processing user entry: ${haUserId}`, user);
            if (user && user.user_code && user.enabled) {
                userCodesByHAId.set(haUserId, user.user_code);
                logger.debug(`Added user: ${user.full_name || 'Unknown'} (${haUserId}) -> ${user.user_code}`);
            } else {
                logger.debug(`Skipped user ${haUserId}: missing required fields or disabled`, {
                    hasUserCode: !!user?.user_code,
                    isEnabled: !!user?.enabled
                });
            }
        });
        
        logger.debug('Created userCodes map from user-whitelist:', {
            byHAId: Object.fromEntries(userCodesByHAId)
        });

        // Validate incoming message structure.
        if (!msg.data || !msg.data.event || !msg.data.event.new_state || !msg.data.event.new_state.state) {
            throw new Error("Invalid message structure: missing data.event.new_state.state");
        }

        // Extract the state string from the message.
        const state = msg.data.event.new_state.state;
        logger.debug(`Received state: ${state}`);        // Parse the state to extract the action and source (which may contain HA user ID).
        const { action, source } = parseEventState(state);
        logger.debug(`Parsed event state: action="${action}", source="${source}"`);

        // If the event comes from a non-user source (e.g., [RF], [MANUAL]), do nothing.
        if (
            NON_USER_SOURCES.some(
                nonUser =>
                    source.replace(/[\[\]]/g, '').toLowerCase().includes(nonUser)
            )
        ) {
            logger.info(`Unlock event via non-user source "${source}". No disarm action required.`);
            // No output is sent in this case, matching version 1.7.1 behavior.
            return;
        }        // Process the "unlocked" action.
        if (action === 'unlocked') {
            // Parse the source to extract HA user ID
            // Expects format: "[HA_USER_ID] Name" 
            const { haUserId, userName } = parseUserSource(source);
            logger.debug(`Parsed user source: haUserId="${haUserId}"`);
            
            // Require HA user ID for processing - no fallback to names
            if (!haUserId) {
                logger.warn(`No HA user ID found in source "${source}". Skipping disarm action.`);
                // Send error to output 2 with userName if available
                sendError(msg, {
                    error: `No HA user ID found in source "${source}". Skipping disarm action.`,
                    userName: userName || null
                });
                return;
            }

            // Lookup alarm code using HA user ID only
            let alarmCode;
            try {
                alarmCode = lookupAlarmCodeByHAId(haUserId, userCodesByHAId);
                logger.debug(`Using alarm code: ${alarmCode}`);
            } catch (err) {
                throw new Error(`Alarm code lookup failed: ${err.message}`);
            }

            // Build the disarm action payload exactly as required:
            // {
            //   action: 'alarmo.disarm',
            //   data: {
            //     code: <ALARM_CODE>,
            //     entity_id: <ALARM_ENTITY_ID>
            //   }
            // }
            const disarmPayload = {
                action: 'alarmo.disarm',
                data: {
                    code: alarmCode,
                    entity_id: ALARM_ENTITY_ID
                }
            };
            sendSuccess(msg, disarmPayload);
            return;
        } else {
            // For unhandled actions, log a warning and do not send any disarm message.
            logger.warn(`Unhandled action: "${action}". No disarm action dispatched.`, { state });
            return;
        }
    } catch (error) {
        const errorMsg = `Error: ${error.message}`;
        logger.error(errorMsg, { stack: error.stack });
        sendError(msg, { error: errorMsg });
        return;
    }
})();
