/****************************************************
 * Script Title: Pushover Alert for Unrecognized User Code
 * Author: Quentin King
 * Date: 2024-08-28
 * Version: 1.1.0
 ****************************************************/

// Logging controls (can be set via env/context for flexibility)
const LOGGING_ENABLED = env.get('LOGGING_ENABLED') ?? false;
const LOG_LEVEL = env.get('LOG_LEVEL') || 'INFO';
const LOG_TO_CONSOLE = env.get('LOG_TO_CONSOLE') ?? false;

// Notification customization (can be overridden by msg properties)
const priority = msg.priority ?? 1;
const sound = msg.sound ?? 'pushover';
const title = msg.title || 'Unrecognized User Code Detected';

// Import dependencies and check for existence
const pushoverToken = global.get('pushoverTokens')?.alarmToken;
const pushoverUserKey = global.get('pushoverUserKeys')?.quentinUserKey;
const axios = global.get('axios');
const moment = global.get('moment');

if (!pushoverToken || !pushoverUserKey || !axios || !moment) {
    node.error('Missing required global dependencies or tokens.');
    return null;
}

// Get the current time and format it
const timestamp = moment().format('dddd, MMMM D, YYYY, [at] HH:mm');

// Get the unrecognized user's name and error details from the incoming message
const userName = msg.payload.userName || 'Unknown User';
const errorDetail = msg.payload.error ? `\nError: ${msg.payload.error}` : '';

// Prepare the notification message
const message = `An unrecognized code was entered into the system by ${userName} on ${timestamp}.${errorDetail}\nPlease review and update the users code list if necessary.`;

// Logging helper
function logMessage(level, message) {
    if (LOGGING_ENABLED && ['DEBUG', 'INFO', 'WARN', 'ERROR'].indexOf(level) >= ['DEBUG', 'INFO', 'WARN', 'ERROR'].indexOf(LOG_LEVEL)) {
        const logText = `[${new Date().toISOString()}] [${level}] ${message}`;
        if (LOG_TO_CONSOLE) {
            node.log(logText);
        } else {
            node.warn(logText);
        }
    }
}

// Send Pushover notification (with async/await)
async function sendPushoverNotification(message, title, priority = 1, sound = 'pushover') {
    const payload = {
        token: pushoverToken,
        user: pushoverUserKey,
        message,
        title,
        priority,
        sound
    };
    try {
        const response = await axios.post('https://api.pushover.net/1/messages.json', payload);
        if (response.status === 200) {
            logMessage('INFO', 'Pushover notification sent successfully');
        } else {
            logMessage('ERROR', `Pushover API returned a non-200 status code: ${response.status}`);
        }
    } catch (error) {
        logMessage('ERROR', `Failed to send Pushover notification: ${error.message}`);
    }
}

// Log the start of the process
logMessage('INFO', `Start processing unrecognized user code.`);

// Send the notification and return the message
sendPushoverNotification(message, title, priority, sound);
return msg;

/* 
   Previous Change Logs:
   
   Version 1.0.1 - 08/28/2024: Added variables for priority and sound customization.
   Version 1.0.0 - 08/28/2024: Initial version for detecting unrecognized user codes and sending a Pushover notification.
*/
