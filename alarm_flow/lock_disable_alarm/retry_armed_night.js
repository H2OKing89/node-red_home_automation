/*
   ### Revised Alarm State Retry Node with Enhanced Exponential Backoff and Adjustable Jitter

   This script manages retry attempts for rearming the alarm system after it has been disabled.
   When a payload indicating the alarm is disabled arrives, the script starts a timer that eventually
   sends a payload to attempt rearming the alarm. The retry logic now incorporates:
     - **Exponential Backoff:** Delay increases by a configurable backoffFactor (greater than 1 for exponential increase).
     - **Adjustable Jitter:** The delay is modified by a jitter value that can either increase or decrease the delay,
       allowing more natural variation while ensuring it doesn't fall below zero.
   Additionally, a timeout and reset mechanism are in place for robust alarm management.

   #### Outputs:
   1. **Retry or Success (Output 1):** Sends the message if the operation needs to be retried.
   2. **Failure (Output 2):** Sends the message if the retry limit is reached, a timeout occurs, or the operation fails.

   #### Configurations:
   - `retryLimit`: Number of retries before considering the operation a failure.
   - `successPayload`: The payload that indicates a successful rearming of the alarm.
   - `initialDelay`: Base delay between retries in milliseconds (e.g., 30 minutes).
   - `backoffFactor`: Multiplier for exponential backoff (set to 1 for constant delay; >1 for exponential).
   - `maxDelay`: Maximum allowable delay between retries in milliseconds.
   - `jitter`: Maximum jitter in milliseconds. This jitter is applied both positively and negatively.
   - `timeoutDuration`: Duration before a timeout occurs if no new messages are received (e.g., 45 minutes).
   - `loggingEnabled`: Enable or disable logging.
   - `logLevel`: Logging verbosity level.
*/

//////////////////////////
// === Configuration ===
//////////////////////////

const config = {
    retryLimit: 2,                     // Number of retries before failure
    successPayload: 'armed_night',     // Payload indicating success
    initialDelay: 1800000,             // Base delay: 30 minutes (1,800,000 ms)
    backoffFactor: 2,                  // Multiplier for exponential backoff (>1 enables exponential growth)
    maxDelay: 3600000,                 // Maximum delay: 60 minutes (adjusted for exponential backoff)
    jitter: 300000,                    // Maximum jitter: 5 minutes (300,000 ms). Jitter may increase or decrease the delay.
    timeoutDuration: 2700000,          // Timeout duration: 45 minutes (2,700,000 ms)
    loggingEnabled: false,             // Enable or disable logging
    logLevel: 'DEBUG',                 // Log levels: 'DEBUG', 'INFO', 'WARN', 'ERROR'
};

const LOGGING_ENABLED = config.loggingEnabled;
const LOG_LEVEL = config.logLevel;
const LOG_TO_CONSOLE = true; // Set to true to log to console, false to log via debug node

let timeoutTimer = null; // Reference to the timeout timer

////////////////////////////
// === Helper Functions ===
////////////////////////////

/**
 * Logs messages with a timestamp and log level.
 * @param {string} level - The log level ('DEBUG', 'INFO', 'WARN', 'ERROR').
 * @param {string} message - The message to log.
 */
function logMessage(level, message) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(LOG_LEVEL);
    const messageLevelIndex = levels.indexOf(level);

    if (LOGGING_ENABLED && messageLevelIndex >= currentLevelIndex) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${level}] ${message}`;
        if (LOG_TO_CONSOLE) {
            node.log(logEntry);
        } else {
            node.warn(logEntry);
        }
    }
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
 * Schedules a retry with exponential backoff and adjustable jitter.
 * @param {object} msg - The message object to resend.
 * @param {number} retries - The current retry attempt.
 */
function scheduleRetry(msg, retries) {
    const delay = calculateExponentialBackoff(retries);
    const jitteredDelay = addFullJitter(delay);
    logMessage('DEBUG', `Scheduling retry ${retries} in ${jitteredDelay.toFixed(0)}ms`);

    const nextRetryInMinutes = (jitteredDelay / 60000).toFixed(1);
    node.status({ fill: 'yellow', shape: 'dot', text: `Retrying (${retries}/${config.retryLimit}) in ${nextRetryInMinutes}m` });

    setTimeout(() => {
        logMessage('INFO', `Executing retry ${retries} of ${config.retryLimit}. Sending message.`);
        node.send([msg, null]); // Output 1: Retry
        node.status({ fill: 'yellow', shape: 'dot', text: `Retrying (${retries}/${config.retryLimit})` });
    }, jitteredDelay);
}

/**
 * Resets the retry mechanism by clearing retry counts and timers.
 */
function resetRetryMechanism() {
    context.set('retries', 0);
    logMessage('INFO', 'Retries count reset to 0.');
    node.status({ fill: 'green', shape: 'dot', text: 'Retry mechanism reset' });
    clearTimeoutTimer();
}

/**
 * Handles unexpected errors by logging them.
 * @param {Error} error - The error object.
 */
function handleError(error) {
    logMessage('ERROR', `Unexpected error: ${error.message}`);
}

/**
 * Starts or resets the timeout timer.
 */
function startTimeout() {
    clearTimeoutTimer();
    timeoutTimer = setTimeout(() => {
        logMessage('ERROR', `Operation timed out after ${config.timeoutDuration / 60000} minutes without new messages.`);
        resetRetryMechanism();
        node.send([null, { payload: 'timeout' }]); // Output 2: Timeout message
    }, config.timeoutDuration);
}

/**
 * Clears the existing timeout timer.
 */
function clearTimeoutTimer() {
    if (timeoutTimer !== null) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
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
    // Retrieve the current retry count from context
    let retries = context.get('retries') || 0;

    // Check if a retry countdown is active
    const countdownActive = isCountdownActive();

    if (countdownActive) {
        if (msg.payload === config.successPayload) {
            // Reset mechanism on receiving the rearm success signal
            resetRetryMechanism();
            logMessage('INFO', `Reset message received: ${msg.payload}. Retry mechanism reset.`);
            node.status({ fill: 'green', shape: 'dot', text: 'Success: rearmed' });
            return null; // No message sent downstream
        } else {
            // Drop any additional messages during active countdown
            logMessage('WARN', `Message dropped due to active countdown. Payload: ${msg.payload}`);
            return null;
        }
    }

    // Start or refresh the timeout timer on valid message reception
    startTimeout();

    if (msg.payload === config.successPayload) {
        // On successful rearm, reset the mechanism
        resetRetryMechanism();
        logMessage('INFO', `Success: ${msg.payload}. Retry mechanism reset.`);
        node.status({ fill: 'green', shape: 'dot', text: 'Success: rearmed' });
        return null;
    } else {
        if (retries === 0) {
            // First attempt: schedule the initial retry after delay
            retries += 1;
            context.set('retries', retries);
            logMessage('DEBUG', `Initial rearm attempt scheduled as retry ${retries}.`);
            scheduleRetry(msg, retries);
            node.status({ fill: 'yellow', shape: 'dot', text: `Initial rearm attempt in ${(config.initialDelay / 60000).toFixed(1)}m` });
            // Do not send the message immediately; it will be sent by the scheduler
        } else if (retries < config.retryLimit) {
            // For subsequent attempts, schedule a retry only after the delay
            retries += 1;
            context.set('retries', retries);
            logMessage('DEBUG', `Retry attempt ${retries} for payload: ${msg.payload}.`);
            scheduleRetry(msg, retries);
            // Do not send the message immediately; it will be sent by the scheduler
        } else {
            // Exceeded retry limit: consider operation failed
            logMessage('ERROR', `Rearm failed after ${config.retryLimit} attempts.`);
            resetRetryMechanism();
            node.status({ fill: 'red', shape: 'dot', text: 'Failure: retry limit reached' });
            node.send([null, msg]);  // Output 2: Failure
        }
    }
} catch (error) {
    handleError(error);
    node.send([null, null]); // Optionally, handle error cases
}
