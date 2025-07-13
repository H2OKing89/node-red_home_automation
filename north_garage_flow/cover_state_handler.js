// Node-RED function: Garage Door State & Override Handler
// Input: msg (from Home Assistant event node)
// Output: msg with additional properties for automation logic
//
// Logging Strategy:
// - node.log() for important automation events (timer actions, garage close commands)
// - node.warn() for expected conditions that prevent automation (override active)
// - node.debug() for non-critical information and flow control
// - node.error() for unexpected errors that need attention
// - node.status() for visual feedback in Node-RED editor

// === Configurable Timer Settings ===
const BASE_TIMER_MS = 15 * 60 * 1000; // 15 minutes
const INCREMENT_MS = 2 * 60 * 1000;   // +2 minutes per detection
const MAX_TIMER_MS = 30 * 60 * 1000;  // Max 30 minutes

// === Context Keys ===
const TIMER_KEY = 'garage_timer_expiry';
const DURATION_KEY = 'garage_timer_duration';

// === Helper: Get current time ===
const now = Date.now();

// === Extract state information ===
// New state (what triggered this message)
const newState = msg.payload;
const oldState = msg.data?.event?.old_state?.state;
const entityId = msg.topic;

// Current states from attached context
const garageState = msg.garage && msg.garage.message;
const lightsState = msg.garage_lights && msg.garage_lights.message;
const override = msg.override && msg.override.message === 'on';

// Helper to check if this is an actual state transition
function isStateTransition(oldState, newState) {
    return oldState && newState && oldState !== newState;
}

// Helper to get friendly name from data
function getFriendlyName(msg) {
    return msg.data?.event?.new_state?.attributes?.friendly_name || msg.topic;
}

// Extract relevant garage state for legacy compatibility
let state;
try {
    state = garageState || newState; // Use attached context first, fallback to payload
} catch (error) {
    node.error('Failed to extract garage state: ' + error.message, msg);
    state = 'unknown';
}

// Outputs: [toTrigger, toClose]

// Helper to build timer/trigger messages with context
function buildTriggerMsg(delay, garage, override) {
    return {
        delay: delay,
        trigger_close: true,
        garage: garage,
        override: override
    };
}
function buildResetMsg(garage, override) {
    return {
        reset: true,
        garage: garage,
        override: override
    };
}

// === Constants for camera entities ===
const INTERIOR_CAM = 'binary_sensor.g5_flex_north_garage_person_detected';
const EXTERIOR_CAM = 'binary_sensor.g5_bullet_drive_north_person_detected';

// === Check for person detection with state transition detection ===
if (entityId === INTERIOR_CAM || entityId === EXTERIOR_CAM) {
    const friendlyName = getFriendlyName(msg);
    
    // Only act on actual state transitions to 'on' (person detected)
    if (isStateTransition(oldState, newState) && newState === 'on') {
        msg.person_detected = true;
        msg.person_sensor = entityId;
        msg.person_sensor_name = friendlyName;
        
        if (!override && state === 'open') {
            let duration = flow.get(DURATION_KEY) || BASE_TIMER_MS;
            duration = Math.min(duration + INCREMENT_MS, MAX_TIMER_MS);
            flow.set(DURATION_KEY, duration);
            flow.set(TIMER_KEY, now + duration);
            node.status({fill:'blue',shape:'dot',text:`${friendlyName} detected, timer extended: ${(duration/60000).toFixed(0)} min`});
            node.log(`${friendlyName} detected person - extending garage timer to ${(duration/60000).toFixed(0)} minutes`);
            return [buildTriggerMsg(duration, msg.garage, msg.override), null];
        } else if (state !== 'open') {
            node.status({fill:'grey',shape:'ring',text:`${friendlyName} detected, garage not open`});
            node.debug(`${friendlyName} detected person, but garage is not open - cancelling timer`);
            return [buildResetMsg(msg.garage, msg.override), null];
        } else if (override) {
            node.status({fill:'yellow',shape:'ring',text:`${friendlyName} detected, override active`});
            node.warn(`${friendlyName} detected person, but override is active - ignoring`);
            return [null, null];
        }
    } else if (newState === 'on') {
        // Person detected but no state change (repeated report)
        node.debug(`${friendlyName} person detection report (no state change): ${newState}`);
        return [null, null];
    } else if (newState === 'off') {
        // Person no longer detected
        node.debug(`${friendlyName} person no longer detected`);
        return [null, null];
    }
}

// North Garage Door (to house): extend timer on state transitions if garage is open and not overridden
if (entityId === 'binary_sensor.north_garage_entry_door' && isStateTransition(oldState, newState)) {
    const friendlyName = getFriendlyName(msg);
    
    if (!override && state === 'open') {
        let duration = flow.get(DURATION_KEY) || BASE_TIMER_MS;
        duration = Math.min(duration + INCREMENT_MS, MAX_TIMER_MS);
        flow.set(DURATION_KEY, duration);
        flow.set(TIMER_KEY, now + duration);
        node.status({fill:'orange',shape:'dot',text:`${friendlyName} ${newState === 'on' ? 'opened' : 'closed'}, timer extended: ${(duration/60000).toFixed(0)} min`});
        node.log(`${friendlyName} ${newState === 'on' ? 'opened' : 'closed'} - extending garage timer to ${(duration/60000).toFixed(0)} minutes`);
        return [buildTriggerMsg(duration, msg.garage, msg.override), null];
    } else if (override) {
        node.status({fill:'yellow',shape:'ring',text:`${friendlyName} activity, override active`});
        node.warn(`${friendlyName} activity detected, but override is active - ignoring`);
        return [null, null];
    } else if (state !== 'open') {
        node.debug(`${friendlyName} activity, but garage is not open - no timer action`);
        return [null, null];
    }
}

// Ignore light state events (do not affect garage timer)
if (entityId === 'light.north_garage_lights') {
    node.debug('Ignoring light state event for garage timer logic');
    return [null, null];
}

// Handle garage door state changes with proper transition detection
if (entityId === 'cover.north_garage_door' && isStateTransition(oldState, newState)) {
    const friendlyName = getFriendlyName(msg);
    node.debug(`${friendlyName} state transition: ${oldState} -> ${newState}`);
    
    // Update state variable for downstream logic
    state = newState;
}

// Add state info to msg for downstream nodes
msg.garage_state = state;
msg.automation_override = override;

// If override is on and timer is running, reset the timer
if (override) {
    const expiry = flow.get(TIMER_KEY);
    if (expiry) {
        flow.set(TIMER_KEY, null);
        flow.set(DURATION_KEY, BASE_TIMER_MS);
        node.status({fill:'yellow',shape:'dot',text:'Override active, timer reset'});
        node.warn('Override is active - cancelling garage timer');
        // Cancel any running timer
        return [buildResetMsg(msg.garage, msg.override), null];
    } else {
        node.status({fill:'yellow',shape:'dot',text:'Override active'});
        return [null, null];
    }
}
node.status({}); // Clear status

// === Start timer when garage is opened, even if no person detected ===
if (state === 'open') {
    const expiry = flow.get(TIMER_KEY);
    if (!expiry) {
        flow.set(DURATION_KEY, BASE_TIMER_MS);
        flow.set(TIMER_KEY, now + BASE_TIMER_MS);
        flow.set('garage_opened_at', now); // Track when garage was opened
        node.status({fill:'green',shape:'dot',text:'Garage open, timer started: 15 min'});
        node.log('Garage opened - starting 15 minute timer');
        return [buildTriggerMsg(BASE_TIMER_MS, msg.garage, msg.override), null, null];
    }
}

// === Timer check: If garage is open, check if timer expired ===
if (state === 'open') {
    // If this is a loopback from the trigger node, it will have a property we can check
    if (msg.trigger_close === true) {
        node.status({fill:'red',shape:'dot',text:'Timer expired, closing'});
        node.log('Timer expired - closing garage door automatically');
        // Reset timer
        flow.set(TIMER_KEY, null);
        flow.set(DURATION_KEY, BASE_TIMER_MS);
        // Calculate how long the cover was open
        const openedAt = flow.get('garage_opened_at');
        let openDuration = null;
        if (openedAt) {
            openDuration = Math.round((now - openedAt) / 1000); // seconds
            flow.set('garage_opened_at', null);
            node.log(`Garage was open for ${openDuration} seconds before auto-close`);
        }
        // Send close command out output 2, and status to output 3
        return [null, {
            payload: {
                action: "cover.close_cover",
                data: {},
                target: {
                    entity_id: "cover.north_garage_door"
                }
            }
        }, {
            payload: {
                message: 'Timer expired, closing garage cover',
                openDurationSeconds: openDuration
            }
        }];
    }
}

// === If garage is closed, stop and reset timer ===
if (state === 'closed') {
    flow.set(TIMER_KEY, null);
    flow.set(DURATION_KEY, BASE_TIMER_MS);
    node.status({fill:'grey',shape:'dot',text:'Garage closed, timer reset'});
    node.log('Garage closed - resetting timer');
    // Cancel any running timer
    return [buildResetMsg(msg.garage, msg.override), null];
}

// Block all other messages
node.debug(`No garage automation action taken for ${entityId}: ${oldState} -> ${newState}`, msg);
return [null, null];
