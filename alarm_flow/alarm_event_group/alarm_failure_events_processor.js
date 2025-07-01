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
        node.error("Received message is not an object.");
        return null;
    }

    if (!msg.payload || typeof msg.payload !== 'object') {
        node.error("Message payload is missing or not an object.", msg);
        return null;
    }

    if (!msg.payload.event || typeof msg.payload.event !== 'object') {
        node.error("Event is missing or not an object in the payload.", msg);
        return null;
    }

    // Retrieve and normalize the command from flow context
    let command = flow.get('command');
    command = (command || "").toUpperCase();

    if (!command || !modeMapping[command]) {
        node.error("Mode is missing or unrecognized in the payload. Cannot proceed.", msg);
        return null;
    }

    node.log(`Mode set: ${modeMapping[command]}`);

    // Process the action with enhanced error context
    const action = msg.payload.event.action;
    if (typeof action !== 'string') {
        node.error("Action is not a valid string.", msg);
        return null;
    }
    // Use a switch-case to process actions, sending all through single output
    switch (action) {
        case 'ALARMO_RETRY_ARM':
            node.log("Processing Retry Arm Action");
            msg.payload = { ...msg.payload, mode: modeMapping[command], action_type: 'retry', force: false };
            return msg;  // Single output
        case 'ALARMO_FORCE_ARM':
            node.log("Processing Force Arm Action");
            msg.payload = { ...msg.payload, mode: modeMapping[command], action_type: 'force', force: true };
            return msg;  // Single output
        default:
            node.warn(`Unrecognized action: ${action}`);
            // Optionally, route to a default error node or output
            return null;
    }
} catch (error) {
    node.error(`Unexpected error in Mobile App Notification Action Processor: ${error.message}`, msg);
    return null;
}
