/****************************************************
 * Alarm State Router
 * Author: Quentin King
 * Version: 1.4.0
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

const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.4.0';

/**
 * Simple logging function
 * @param {string} message - Content to log
 * @param {string} level - Severity level (info, warn, error)
 */
function log(message, level = "info") {
  if (!LOGGING_ENABLED) return;
  if (level === "error") node.error(message);
  else if (level === "warn") node.warn(message);
  else node.log(message);
}

// Load enabled user full_names from user-whitelist in global context
const userWhitelist = global.get('user-whitelist', 'file') || {};
const knownUsers = Array.from(new Set([
  ...Object.values(userWhitelist)
    .filter(u => u.enabled && typeof u.full_name === 'string')
    .map(u => u.full_name.toLowerCase()),
  'system' // Always allow 'System' as a valid user for automations
]));
log(`knownUsers loaded from user-whitelist (+system): ${JSON.stringify(knownUsers)}`);

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
  log(`validateInputs(stateValid=${stateValid}, userValid=${userValid})`);
  return stateValid && userValid;
}

/**
 * routeNormal: Handles non-DURESS routing (Output 2).
 * @param {string|null} user - The triggering user or null for system
 * @param {string|null} state - The alarm state
 * @param {object} msg - The incoming message object
 * @returns {Array} - Node-RED outputs [null, msg, null]
 */
function routeNormal(user, state, msg) {
  log(`routeNormal invoked for user=${user}`);
  log(`Routing to Output 2 (Normal) - User: ${user || 'Home Assistant'}, State: ${state}`);
  
  // Update node status to show normal routing
  node.status({ fill: "blue", shape: "dot", text: `${state} by ${user || 'System'}` });
  
  return [null, msg, null];
}

// Top-level guard: ensure msg is an object with expected structure
log(`Received msg: ${JSON.stringify(msg)}`);
if (typeof msg !== 'object' || !msg.data || !msg.data.event) {
  log('Malformed msg object', 'error');
  node.status({ fill: "red", shape: "ring", text: "Invalid message structure" });
  node.error(
    new Error(
      `Invalid msg object: expected structure { data: { event: ... } }. ` +
      `Received: ${JSON.stringify({
        hasData: !!msg.data,
        hasEvent: !!(msg.data && msg.data.event)
      })}`
    ),
    msg
  );
  return [null, null, msg];  // Output 3: treat as unknown
}

// Extract the 'changed_by' attribute and new state from the payload
const userWhoChanged = msg.data.event.new_state?.attributes?.changed_by;
const alarmState = msg.data.event.new_state?.state;
log(`Extracted user=${userWhoChanged}, state=${alarmState}`);

// 1. DURESS override: Immediate priority to Output 1
log('Checking for duress override');
if (userWhoChanged === 'DURESS') {
  log('🚨 DURESS DETECTED!', 'warn');
  node.status({ fill: "red", shape: "dot", text: "DURESS ALERT" });
  
  // Track duress activations in context
  const duressRoutes = context.get('duress_routes') || [];
  duressRoutes.push({
    timestamp: new Date().toISOString(),
    state: alarmState
  });
  if (duressRoutes.length > 10) duressRoutes.shift();
  context.set('duress_routes', duressRoutes);
  
  return [msg, null, null];  // Output 1: Duress
}

// 2. Empty knownUsers fallback: treat as configuration error
log(`knownUsers.length=${knownUsers.length}`);
if (knownUsers.length === 0) {
  log('No known users configured', 'warn');
  node.status({ fill: "yellow", shape: "ring", text: "No known users" });
  // Warn only - this is a configuration issue, not a runtime error
  node.warn('Known users list is empty. Please populate user-whitelist in global context.');
  // Clone msg to avoid mutating original, set payload to error notice
  const errMsg = { ...msg, payload: 'Known users list is empty. Please populate it.' };
  return [null, null, errMsg];  // Output 3: config issue
}

// 3. Validate inputs for normal routing
try {
  log('Validating inputs before routing');
  if (!validateInputs(userWhoChanged, alarmState)) {
    log(`Unknown or invalid user: ${userWhoChanged}`, 'warn');
    node.status({ fill: "yellow", shape: "ring", text: `Unknown: ${userWhoChanged}` });
    // Warn only - unauthorized access attempts are expected behavior, not critical errors
    node.warn(`Invalid/unknown user attempted access: ${userWhoChanged}`);
    
    // Track unknown user attempts in context
    const unknownAttempts = context.get('unknown_attempts') || [];
    unknownAttempts.push({
      timestamp: new Date().toISOString(),
      user: userWhoChanged,
      state: alarmState
    });
    if (unknownAttempts.length > 20) unknownAttempts.shift();
    context.set('unknown_attempts', unknownAttempts);
    
    return [null, null, msg];  // Output 3: unknown user
  }
  
  // 4. All checks passed: normal routing
  return routeNormal(userWhoChanged, alarmState, msg);
} catch (err) {
  // Catch unexpected errors to avoid silent failures
  log(`Exception caught: ${err.message}`, 'error');
  node.status({ fill: "red", shape: "ring", text: `Error: ${err.message}` });
  node.error(err, msg);
  return [null, null, msg];  // Output 3: error path
}
