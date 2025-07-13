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

// Extract relevant info once
let state;
try {
    if (msg.garage && msg.garage.message) {
        state = msg.garage.message; // Use new nested garage state
    } else {
        state = msg.payload; // Fallback to old method
    }
} catch (error) {
    node.error('Failed to extract garage state: ' + error.message, msg);
    state = 'unknown';
}
const override = msg.override && msg.override.message === 'on'; // true if override is on

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

// === Check for person detection ===
if (msg.topic && msg.topic.startsWith('binary_sensor.g5_') && msg.topic.endsWith('_person_detected')) {
    msg.person_detected = msg.payload === 'on';
    msg.person_sensor = msg.topic;
    if (msg.data && msg.data.event && msg.data.event.new_state && msg.data.event.new_state.attributes) {
        msg.person_sensor_name = msg.data.event.new_state.attributes.friendly_name || msg.topic;
    } else {
        msg.person_sensor_name = msg.topic;
    }
    if (msg.person_detected && !override && state === 'open') {
        let duration = flow.get(DURATION_KEY) || BASE_TIMER_MS;
        duration = Math.min(duration + INCREMENT_MS, MAX_TIMER_MS);
        flow.set(DURATION_KEY, duration);
        flow.set(TIMER_KEY, now + duration);
        node.status({fill:'blue',shape:'dot',text:`Timer extended: ${(duration/60000).toFixed(0)} min`});
        node.log(`Person detected - extending garage timer to ${(duration/60000).toFixed(0)} minutes`);
        // Send delay update to trigger node, include context
        return [buildTriggerMsg(duration, msg.garage, msg.override), null];
    } else if (msg.person_detected && state !== 'open') {
        node.status({fill:'grey',shape:'ring',text:'Person detected, garage not open'});
        // Cancel any running timer
        return [buildResetMsg(msg.garage, msg.override), null];
    }
    return [null, null];
}

// North Garage Door (to house): extend timer on any state change if garage is open and not overridden
if (msg.topic === 'binary_sensor.north_garage' && !override && state === 'open') {
    let duration = flow.get(DURATION_KEY) || BASE_TIMER_MS;
    duration = Math.min(duration + INCREMENT_MS, MAX_TIMER_MS);
    flow.set(DURATION_KEY, duration);
    flow.set(TIMER_KEY, now + duration);
    node.status({fill:'orange',shape:'dot',text:`House door event, timer extended: ${(duration/60000).toFixed(0)} min`});
    node.log(`House door activity - extending garage timer to ${(duration/60000).toFixed(0)} minutes`);
    return [buildTriggerMsg(duration, msg.garage, msg.override), null];
}

// Ignore light state events (do not affect garage timer)
if (msg.topic === 'light.north_garage_lights') {
    node.debug('Ignoring light state event for garage timer logic');
    return [null, null];
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
        node.status({fill:'green',shape:'dot',text:'Timer started: 15 min'});
        node.log('Garage opened - starting 15 minute timer');
        // Start trigger node with base delay, include context
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
node.debug('No garage automation action taken for message:', msg);
return [null, null];
