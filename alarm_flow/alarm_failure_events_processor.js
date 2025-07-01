// Script Name: Mobile App Notification Action Processor
// Platform: Node-RED
// Flow: Home Automation
// Group: Alarm Management
// Date: 2024-08-28
// Version: 1.0.2 (Edge Case Enhancements)
// Author: Quentin King

/*
   ### Mobile App Notification Action Processor
   
   This script processes the 'mobile_app_notification_action' event, ensuring that the 
   'mode' field is correctly set in the payload before passing it on. Enhanced to handle 
   edge cases such as missing or malformed data.
*/

// Logging controls
const LOGGING_ENABLED = false; // Set to true for detailed logging
const LOG_LEVEL = 'INFO'; // Desired log level: 'DEBUG', 'INFO', 'WARN', 'ERROR'
const LOG_TO_CONSOLE = true; // Log to console if true, else log to debug node

// Helper function for logging messages
function logMessage(level, message, context = {}) {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const currentLevelIndex = levels.indexOf(LOG_LEVEL);
    const messageLevelIndex = levels.indexOf(level);

    // Always log errors
    if (level === 'ERROR' || (LOGGING_ENABLED && messageLevelIndex >= currentLevelIndex)) {
        let logText = `[${new Date().toISOString()}] [${level}] ${message}`;
        if (Object.keys(context).length > 0) {
            logText += ` | Context: ${JSON.stringify(context)}`;
        }
        if (LOG_TO_CONSOLE) {
            node.log(logText);
        } else {
            node.warn(logText);
        }
    }
}

// Mode mapping configuration
const modeMapping = {
    'ARM_HOME': 'home',
    'ARM_AWAY': 'away',
    'ARM_NIGHT': 'night',
    'ARM_CUSTOM_BYPASS': 'armed_custom_bypass',
    'ARM_VACATION': 'armed_vacation'
};

try {
    // Validate incoming msg structure
    if (!msg || typeof msg !== 'object') {
        logMessage('ERROR', "Received message is not an object.");
        return null;
    }

    if (!msg.payload || typeof msg.payload !== 'object') {
        logMessage('ERROR', "Message payload is missing or not an object.", { payload: msg.payload });
        return null;
    }

    if (!msg.payload.event || typeof msg.payload.event !== 'object') {
        logMessage('ERROR', "Event is missing or not an object in the payload.", { payload: msg.payload });
        return null;
    }

    // Retrieve and normalize the command from flow context
    let command = flow.get('command');
    command = (command || "").toUpperCase();

    if (!command || !modeMapping[command]) {
        logMessage('ERROR', "Mode is missing or unrecognized in the payload. Cannot proceed.", { command });
        return null;
    }

    // Log the mode being set
    logMessage('INFO', `Mode set: ${modeMapping[command]}`);

    // Process the action with enhanced error context
    const action = msg.payload.event.action;
    if (typeof action !== 'string') {
        logMessage('ERROR', "Action is not a valid string.", { action });
        return null;
    }    // Use a switch-case to process actions, sending all through single output
    switch (action) {
        case 'ALARMO_RETRY_ARM':
            logMessage('INFO', "Processing Retry Arm Action");
            msg.payload = { ...msg.payload, mode: modeMapping[command], action_type: 'retry', force: false };
            return msg;  // Single output
        case 'ALARMO_FORCE_ARM':
            logMessage('INFO', "Processing Force Arm Action");
            msg.payload = { ...msg.payload, mode: modeMapping[command], action_type: 'force', force: true };
            return msg;  // Single output
        default:
            logMessage('WARN', `Unrecognized action: ${action}`);
            // Optionally, route to a default error node or output
            return null;
    }
} catch (error) {
    logMessage('ERROR', `Unexpected error in Mobile App Notification Action Processor: ${error.message}`, { msg });
    return null;
}
