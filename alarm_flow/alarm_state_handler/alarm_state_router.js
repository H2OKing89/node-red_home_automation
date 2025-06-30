/****************************************************
 * Alarm State Router
 * Author: Quentin King
 * Version: 1.3.8
 *
 * Description:
 * this function node is the first node in the flow
 * This Node-RED function routes alarm state change messages
 * based on the 'changed_by' attribute in the event payload.
 * Prioritizes DURESS overrides, handles normal users,
 * and manages unknown users or empty knownUsers list.
 * - Output 1: DURESS override (always highest priority). this is wired to a switch node then split to duress_alarm_test.js and duress_alarm.js.
 * - Output 2: Normal routing for known users and valid states. it is wired to the alarm state node.
 * - Output 3: Unknown/invalid users or empty knownUsers (non-duress).
 ****************************************************/

// Configuration Flags: toggle overall logging and output destination
const LOGGING_ENABLED = true;     // Master switch for logMessage
const LOG_LEVEL = 'DEBUG';  // Minimum level to log (DEBUG, INFO, WARN, ERROR)
const LOG_TO_CONSOLE = false;   // If true, use node.log(); otherwise use node.warn()

// Define log levels once to avoid recreating the array on each call
const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

// Initial debug message when Node-RED loads this function
node.log('[DEBUG] Initializing Alarm State Router');

/**
 * logMessage: Handles conditional logging based on configured level.
 * @param {string} level - Severity level of the message
 * @param {string} message - Content to log
 */
function logMessage(level, message) {
  if (!LOGGING_ENABLED) return;  // Skip all logging if disabled
  const currentIdx = LOG_LEVELS.indexOf(LOG_LEVEL);
  const msgIdx = LOG_LEVELS.indexOf(level);
  // Only log if level is valid and meets or exceeds the configured threshold
  if (msgIdx < 0 || msgIdx < currentIdx) return;
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  // Choose console or debug node based on LOG_TO_CONSOLE
  LOG_TO_CONSOLE ? node.log(line) : node.warn(line);
}

// Load enabled user full_names from user-whitelist in global context
const userWhitelist = global.get('user-whitelist', 'file') || {};
const knownUsers = Array.from(new Set([
  ...Object.values(userWhitelist)
    .filter(u => u.enabled && typeof u.full_name === 'string')
    .map(u => u.full_name.toLowerCase()),
  'system' // Always allow 'System' as a valid user for automations
]));
node.log(`[DEBUG] knownUsers loaded from user-whitelist (+system): ${JSON.stringify(knownUsers)}`);

/**
 * isValidStringOrNull: Ensures input is either a non-empty string or null.
 * @param {*} value - Value to validate
 * @returns {boolean}
 */
function isValidStringOrNull(value) {
  return value === null || (typeof value === 'string' && value.trim().length > 0);
}

/**
 * validateInputs: Validates that state is valid and user is known.
 * Note: 'DURESS' is handled upstream, so not included here.
 * @param {string|null} user - The 'changed_by' attribute
 * @param {string|null} state - The new alarm state
 * @returns {boolean}
 */
function validateInputs(user, state) {
  const stateValid = isValidStringOrNull(state);
  const userValid = (user === null) || knownUsers.includes((user || '').toLowerCase());
  node.log(`[DEBUG] validateInputs(stateValid=${stateValid}, userValid=${userValid})`);
  return stateValid && userValid;
}

/**
 * routeNormal: Handles non-DURESS routing (Output 2).
 * @param {string|null} user - The triggering user or null for system
 * @param {object} msg - The incoming message object
 * @returns {Array} - Node-RED outputs [null, msg, null]
 */
function routeNormal(user, msg) {
  node.log(`[DEBUG] routeNormal invoked for user=${user}`);
  logMessage('INFO', `Routing to Output 2 (Normal) - User: ${user || 'Home Assistant'}`);
  return [null, msg, null];
}

// Top-level guard: ensure msg is an object with expected structure
node.log(`[DEBUG] Received msg: ${JSON.stringify(msg)}`);
if (typeof msg !== 'object' || !msg.data || !msg.data.event) {
  node.log('[ERROR] Malformed msg object');
  logMessage('ERROR', 'Invalid msg object; routing to Output 3.');
  return [null, null, msg];  // Output 3: treat as unknown
}

// Extract the 'changed_by' attribute and new state from the payload
const userWhoChanged = msg.data.event.new_state?.attributes?.changed_by;
const alarmState = msg.data.event.new_state?.state;
node.log(`[DEBUG] Extracted user=${userWhoChanged}, state=${alarmState}`);

// 1. DURESS override: Immediate priority to Output 1
node.log('[DEBUG] Checking for duress override');
if (userWhoChanged === 'DURESS') {
  node.log('[INFO] Duress detected');
  logMessage('INFO', 'Duress detected. Routing to Output 1.');
  return [msg, null, null];  // Output 1: Duress
}

// 2. Empty knownUsers fallback: treat as configuration error
node.log(`[DEBUG] knownUsers.length=${knownUsers.length}`);
if (knownUsers.length === 0) {
  node.log('[WARN] No known users configured');
  logMessage('WARN', 'Known users list empty. Routing to Output 3.');
  // Clone msg to avoid mutating original, set payload to error notice
  const errMsg = { ...msg, payload: 'Known users list is empty. Please populate it.' };
  return [null, null, errMsg];  // Output 3: config issue
}

// 3. Validate inputs for normal routing
try {
  node.log('[DEBUG] Validating inputs before routing');
  if (!validateInputs(userWhoChanged, alarmState)) {
    node.log(`[WARN] Unknown or invalid user: ${userWhoChanged}`);
    logMessage('WARN', `Invalid/unknown user. Routing to Output 3 - User: ${userWhoChanged}`);
    return [null, null, msg];  // Output 3: unknown user
  }
  // 4. All checks passed: normal routing
  return routeNormal(userWhoChanged, msg);
} catch (err) {
  // Catch unexpected errors to avoid silent failures
  node.log(`[ERROR] Exception caught: ${err.message}`);
  logMessage('ERROR', `Unexpected error: ${err.message}`);
  return [null, null, msg];  // Output 3: error path
}
