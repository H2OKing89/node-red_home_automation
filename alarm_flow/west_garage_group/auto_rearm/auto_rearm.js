/*
   ### West Garage Auto-Rearm with Exponential Backoff and Jitter
   
   Script Name: West Garage Auto-Rearm
   Version: 1.1.0
   Date: 2025-10-05
   
   This script manages retry attempts for automatically rearming the west garage alarm system 
   after it has been disarmed. The script monitors the alarm state and automatically attempts 
   to rearm to 'armed_custom_bypass' mode.
   
   #### Message Structure:
   - Input: msg.alarm_control_panel_west_garage.payload (values: 'disarmed' or 'armed_custom_bypass')
   - Output: msg.payload set to 'arm_custom_bypass' for service call
   
   #### Retry Logic:
   - **Exponential Backoff:** Delay increases by a configurable backoffFactor (greater than 1 for exponential increase).
   - **AWS-Style Full Jitter:** Random delay between 0 and the exponential backoff value for natural variation.
   - **Timeout Protection:** Resets if no messages received within timeout period.

   #### Setup Requirements:
   - **Timeout (NR >= 3.1):** Set Function timeout in Setup tab to 60+ seconds to prevent premature kills
   - **Outputs:** Configure 2 outputs in the Function node
   - **Lifecycle:** Uses On Start/On Stop tabs for proper timer cleanup (NR >= 1.1)

   #### Outputs:
   1. **Retry or Success (Output 1):** Sends the message to trigger rearm service call.
   2. **Failure (Output 2):** Sends the message if the retry limit is reached, a timeout occurs, or the operation fails.

   #### Configurations:
   - `retryLimit`: Number of retries before considering the operation a failure.
   - `successPayload`: The alarm state that indicates successful rearming ('armed_custom_bypass').
   - `disarmedPayload`: The alarm state that triggers auto-rearm ('disarmed').
   - `initialDelay`: Base delay between retries in milliseconds (e.g., 30 minutes).
   - `backoffFactor`: Multiplier for exponential backoff (set to 1 for constant delay; >1 for exponential).
   - `maxDelay`: Maximum allowable delay between retries in milliseconds.
   - `timeoutDuration`: Duration before a timeout occurs if no new messages are received (e.g., 45 minutes).
   
   Changelog:
   - 1.1.0: Added proper lifecycle management, improved async patterns, enhanced error handling
   - 1.0.0: Initial west garage version with alarm_control_panel_west_garage message structure
   
   === ON START TAB CODE ===
   // Initialize context state
   if (context.get("init") !== true) {
       context.set('retries', 0);
       node.status({ fill: 'blue', shape: 'dot', text: 'Initialized' });
       context.set("init", true);
       node.log('West garage auto-rearm initialized');
   }
   
   === ON STOP TAB CODE ===
   // Cleanup timers on node stop/redeploy
   const timeoutTimer = context.get('timeoutTimer');
   if (timeoutTimer) {
       clearTimeout(timeoutTimer);
       context.set('timeoutTimer', null);
       node.log('West garage auto-rearm cleanup: timeout timer cleared');
   }
   
   // Reset retry mechanism
   context.set('retries', 0);
   node.status({ fill: 'grey', shape: 'dot', text: 'Stopped' });
*/

//////////////////////////
// === Configuration ===
//////////////////////////

const config = {
    retryLimit: 3,                            // Number of retries before failure
    successPayload: 'armed_custom_bypass',    // West garage armed state
    disarmedPayload: 'disarmed',              // West garage disarmed state (triggers auto-rearm)
    serviceCallPayload: 'arm_custom_bypass',  // Payload to send for service call
    initialDelay: 1800000,                    // Base delay: 30 minutes (1,800,000 ms)
    backoffFactor: 2,                         // Multiplier for exponential backoff (>1 enables exponential growth)
    maxDelay: 3600000,                        // Maximum delay: 60 minutes (adjusted for exponential backoff)
    timeoutDuration: 2700000                  // Timeout duration: 45 minutes (2,700,000 ms)
};

// Logging toggle for development/production
const LOGGING_ENABLED = true;

////////////////////////////
// === Helper Functions ===
////////////////////////////

/**
 * Structured logging helper following Node-RED Function guide patterns.
 * @param {string} message - The message to log.
 * @param {string} level - Log level: 'info', 'warn', 'error', 'debug'.
 */
function log(message, level = "info") {
    if (!LOGGING_ENABLED) return;
    if (level === "error") node.error(message);
    else if (level === "warn") node.warn(message);
    else if (level === "debug") node.debug(message);
    else node.log(message);
}

/**
 * Applies AWS-style full jitter to the calculated delay.
 * Jitter is applied as a random value between 0 and the base delay (exponential backoff).
 * @param {number} delay - The base delay in milliseconds.
 * @returns {number} - The delay with jitter applied.
 */
function addFullJitter(delay) {
    if (delay > 0) {
        return Math.random() * delay;
    }
    return 0;
}

/**
 * Calculates the exponential backoff delay.
 * For retries > 1, the delay increases as:
 *    delay = initialDelay * (backoffFactor)^(retries - 1)
 * The delay is capped at maxDelay.
 * @param {number} retries - The current retry attempt.
 * @returns {number} - The calculated delay in milliseconds.
 */
function calculateExponentialBackoff(retries) {
    const delay = config.initialDelay * Math.pow(config.backoffFactor, retries - 1);
    return Math.min(delay, config.maxDelay);
}

/**
 * Schedules a retry with exponential backoff and AWS full jitter.
 * @param {object} msg - The message object to resend.
 * @param {number} retries - The current retry attempt.
 */
function scheduleRetry(msg, retries) {
    const delay = calculateExponentialBackoff(retries);
    const jitteredDelay = addFullJitter(delay);
    log(`Scheduling retry ${retries} in ${jitteredDelay.toFixed(0)}ms`, "debug");

    const nextRetryInMinutes = (jitteredDelay / 60000).toFixed(1);
    node.status({ fill: 'yellow', shape: 'dot', text: `Retry ${retries}/${config.retryLimit} in ${nextRetryInMinutes}m` });

    const timerId = setTimeout(() => {
        log(`Executing retry ${retries} of ${config.retryLimit}. Sending rearm message.`);
        // Set payload to service call value for west garage
        msg.payload = config.serviceCallPayload;
        node.send([msg, null]); // Output 1: Retry
        node.status({ fill: 'yellow', shape: 'dot', text: `Executing retry ${retries}/${config.retryLimit}` });
        node.done(); // Signal async completion
    }, jitteredDelay);
    
    // Store timer ID for cleanup
    context.set('retryTimer', timerId);
}

/**
 * Resets the retry mechanism by clearing retry counts and timers.
 */
function resetRetryMechanism() {
    clearAllTimers();
    context.set('retries', 0);
    log('West garage auto-rearm mechanism reset.');
    node.status({ fill: 'green', shape: 'dot', text: 'Reset - ready for next cycle' });
}

/**
 * Handles unexpected errors by logging them with proper Catch node integration.
 * @param {Error} error - The error object.
 * @param {object} msg - The message object for Catch node routing.
 */
function handleError(error, msg) {
    log(`Unexpected error: ${error.message}`, "error");
    node.status({ fill: 'red', shape: 'dot', text: `Error: ${error.message}` });
    // Pass msg to enable Catch node routing
    node.error(error, msg);
}

/**
 * Starts or resets the timeout timer.
 */
function startTimeout() {
    clearTimeoutTimer();
    const timerId = setTimeout(() => {
        log(`Operation timed out after ${config.timeoutDuration / 60000} minutes without new messages.`, "error");
        resetRetryMechanism();
        node.send([null, { payload: 'timeout', error: 'timeout' }]); // Output 2: Timeout message
        node.done(); // Signal async completion
    }, config.timeoutDuration);
    
    context.set('timeoutTimer', timerId);
}

/**
 * Clears the existing timeout timer.
 */
function clearTimeoutTimer() {
    const timerId = context.get('timeoutTimer');
    if (timerId) {
        clearTimeout(timerId);
        context.set('timeoutTimer', null);
    }
}

/**
 * Clears all timers (timeout and retry).
 */
function clearAllTimers() {
    clearTimeoutTimer();
    const retryTimer = context.get('retryTimer');
    if (retryTimer) {
        clearTimeout(retryTimer);
        context.set('retryTimer', null);
    }
}

/**
 * Determines if the countdown (retry process) is active.
 * @returns {boolean} - True if countdown is active, else false.
 */
function isCountdownActive() {
    // Only check retries, since timer and retries are always reset together
    return (context.get('retries') || 0) > 0;
}

//////////////////////////////////////
// === Main Execution Logic =========
//////////////////////////////////////

try {
    // Extract alarm state from west garage message structure
    const alarmState = msg.alarm_control_panel_west_garage?.payload;
    
    if (!alarmState) {
        log('No alarm state found in msg.alarm_control_panel_west_garage.payload', "warn");
        node.status({ fill: 'grey', shape: 'dot', text: 'Invalid message structure' });
        node.done();
        return; // Use return; not return null for sync work
    }
    
    log(`Received alarm state: ${alarmState}`, "debug");
    
    // Retrieve the current retry count from context
    let retries = context.get('retries') || 0;

    // Check if a retry countdown is active
    const countdownActive = isCountdownActive();

    if (countdownActive) {
        if (alarmState === config.successPayload) {
            // Reset mechanism on receiving the rearm success signal
            resetRetryMechanism();
            log(`West garage successfully rearmed to: ${alarmState}. Retry mechanism reset.`);
            node.status({ fill: 'green', shape: 'dot', text: 'Success: Armed custom bypass' });
            node.done();
            return; // No message sent downstream
        } else {
            // Drop any additional messages during active countdown
            log(`Message dropped due to active countdown. Alarm state: ${alarmState}`, "warn");
            node.status({ fill: 'yellow', shape: 'dot', text: 'Countdown active - ignoring' });
            node.done();
            return;
        }
    }

    // Start or refresh the timeout timer on valid message reception
    startTimeout();

    if (alarmState === config.successPayload) {
        // On successful rearm, reset the mechanism
        resetRetryMechanism();
        log(`West garage armed to custom bypass: ${alarmState}. Retry mechanism reset.`);
        node.status({ fill: 'green', shape: 'dot', text: 'Armed: Custom bypass' });
        node.done();
        return; // No message sent downstream
    } else if (alarmState === config.disarmedPayload) {
        if (retries === 0) {
            // First attempt: schedule the initial retry after delay
            retries += 1;
            context.set('retries', retries);
            log(`West garage disarmed - initiating auto-rearm sequence (retry ${retries}).`);
            scheduleRetry(msg, retries);
            node.status({ fill: 'yellow', shape: 'dot', text: `Initial rearm in ${(config.initialDelay / 60000).toFixed(1)}m` });
            // Async work scheduled, use return; pattern
            return;
        } else if (retries < config.retryLimit) {
            // For subsequent attempts, schedule a retry only after the delay
            retries += 1;
            context.set('retries', retries);
            log(`Scheduling retry attempt ${retries} for west garage rearm.`, "debug");
            scheduleRetry(msg, retries);
            // Async work scheduled, use return; pattern
            return;
        } else {
            // Exceeded retry limit: consider operation failed
            const errorMsg = `West garage rearm failed after ${config.retryLimit} attempts.`;
            log(errorMsg, "error");
            resetRetryMechanism();
            node.status({ fill: 'red', shape: 'dot', text: 'FAILED: Max retries reached' });
            // Send to failure output with error context
            msg.error = errorMsg;
            msg.retryAttempts = config.retryLimit;
            node.send([null, msg]);  // Output 2: Failure
            node.error(new Error(errorMsg), msg); // Trigger Catch nodes
            node.done();
            return;
        }
    } else {
        // Unexpected alarm state - log and ignore
        log(`Ignoring unexpected alarm state: ${alarmState}`, "debug");
        node.status({ fill: 'grey', shape: 'dot', text: `Ignored: ${alarmState}` });
        node.done();
        return;
    }
} catch (error) {
    handleError(error, msg);
    // Send error context to failure output
    msg.error = error.message;
    msg.errorStack = error.stack;
    node.send([null, msg]); // Output 2: Error
    node.done();
    return;
}
