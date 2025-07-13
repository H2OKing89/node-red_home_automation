// Node-RED function: Garage Interior Lights Automation with Timer
// Outputs: [toTrigger, toOff]
//
// **Note:** When you add `suncalc` as a module in the Node-RED function node's setup tab, you do **not** use `require`. The module is available as a global variable (e.g., `suncalc`).
//
// Logging Strategy:
// - node.log() for important automation events (lights on/off, timer actions)
// - node.warn() for expected conditions that prevent automation (not dark)
// - node.debug() for non-critical information and flow control
// - node.error() for unexpected errors that need attention
// - node.status() for visual feedback in Node-RED editor

// === Configurable Timer Settings ===
const BASE_TIMER_MS = 10 * 60 * 1000; // 10 minutes
const INCREMENT_MS = 2 * 60 * 1000;   // +2 minutes per detection
const MAX_TIMER_MS = 30 * 60 * 1000;  // Max 30 minutes

// === Context Keys ===
const TIMER_KEY = 'garage_lights_timer_expiry';
const DURATION_KEY = 'garage_lights_timer_duration';

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

const INTERIOR_CAM = 'binary_sensor.g5_flex_north_garage_person_detected';
const EXTERIOR_CAM = 'binary_sensor.g5_bullet_drive_north_person_detected';

// Updated to use state transition detection
const isInteriorPersonDetected = entityId === INTERIOR_CAM && isStateTransition(oldState, newState) && newState === 'on';
const isExteriorPersonDetected = entityId === EXTERIOR_CAM && isStateTransition(oldState, newState) && newState === 'on';

// Also check for any person detection (for timer extension logic)
const isAnyPersonDetected = (entityId === INTERIOR_CAM || entityId === EXTERIOR_CAM) && newState === 'on';

function buildTriggerMsg(delay, garage, lights, override) {
    return {
        delay: delay,
        trigger_off: true,
        garage: garage,
        garage_lights: lights,
        override: override
    };
}
function buildResetMsg(garage, lights, override) {
    return {
        reset: true,
        garage: garage,
        garage_lights: lights,
        override: override
    };
}

// Only act if override is off
if (override) {
    node.status({ fill: 'yellow', shape: 'dot', text: 'Override active' });
    flow.set(TIMER_KEY, null);
    flow.set(DURATION_KEY, BASE_TIMER_MS);
    return [buildResetMsg(msg.garage, msg.garage_lights, msg.override), null];
}

// Handle light state changes with proper transition detection
if (entityId === 'light.north_garage_lights') {
    const friendlyName = getFriendlyName(msg);
    
    // Only act on actual state transitions (off -> on or on -> off)
    if (isStateTransition(oldState, newState)) {
        if (newState === 'on') {
            // Light just turned on - re-check automation flag to handle race conditions
            const currentAutomationFlag = flow.get('garage_lights_just_automated') || false;
            if (currentAutomationFlag) {
                // This was triggered by our automation, not manual - preserve existing status
                flow.set('garage_lights_just_automated', false);
                node.log(`${friendlyName} turned on by automation - timer already started`);
                return [null, null]; // Already handled by automation, do not start timer again
            } else {
                // Manual or external turn-on
                flow.set(DURATION_KEY, BASE_TIMER_MS);
                flow.set(TIMER_KEY, now + BASE_TIMER_MS);
                node.status({ fill: 'blue', shape: 'ring', text: 'Manual lights on, timer start' });
                node.log(`${friendlyName} turned on manually - starting timer`);
                return [buildTriggerMsg(BASE_TIMER_MS, msg.garage, msg.garage_lights, msg.override), null];
            }
        } else if (newState === 'off') {
            // Light just turned off - reset timer
            flow.set(TIMER_KEY, null);
            flow.set(DURATION_KEY, BASE_TIMER_MS);
            node.status({ fill: 'grey', shape: 'dot', text: 'Lights turned off, timer reset' });
            node.log(`${friendlyName} turned off - resetting timer`);
            return [buildResetMsg(msg.garage, msg.garage_lights, msg.override), null];
        }
    } else {
        // No state change, ignore repeated state reports
        node.debug(`${friendlyName} state report (no change): ${newState}`);
        return [null, null];
    }
}

// === SunCalc: Only allow automation to turn on lights between dusk and dawn ===
// Note: suncalc is available as a global variable in Node-RED function nodes; do not use require().
const nowDate = new Date();
const LAT = 40.854118;
const LON = -96.717293;

let sunTimes, isDark;
try {
    sunTimes = suncalc.getTimes(nowDate, LAT, LON);
    isDark = nowDate < sunTimes.dawn || nowDate > sunTimes.dusk;
} catch (error) {
    node.error('Failed to calculate sun times: ' + error.message, msg);
    // Fallback to always allow automation if SunCalc fails
    isDark = true;
    sunTimes = { dawn: new Date(), dusk: new Date() };
}

// Helper for dusk/dawn status
function duskStatus(nowDate, sunTimes) {
    return `Now: ${nowDate.toLocaleTimeString()} | Dusk: ${sunTimes.dusk.toLocaleTimeString()} | Dawn: ${sunTimes.dawn.toLocaleTimeString()}`;
}

// Interior camera: turn on lights and start timer if detection and lights are off
if (isInteriorPersonDetected && lightsState === 'off') {
    const friendlyName = getFriendlyName(msg);
    if (isDark) {
        flow.set(DURATION_KEY, BASE_TIMER_MS);
        flow.set(TIMER_KEY, now + BASE_TIMER_MS);
        flow.set('garage_lights_just_automated', true); // Set automation flag
        node.status({ fill: 'blue', shape: 'dot', text: 'Interior person, lights ON, timer start' });
        node.log(`${friendlyName} detected person - turning on garage lights and starting timer`);
        return [buildTriggerMsg(BASE_TIMER_MS, msg.garage, msg.garage_lights, msg.override), {
            payload: {
                action: "light.turn_on",
                data: {},
                target: {
                    entity_id: "light.north_garage_lights"
                }
            }
        }, null];
    } else {
        const duskStats = duskStatus(nowDate, sunTimes);
        node.status({ fill: 'grey', shape: 'ring', text: `Not dark: ${duskStats}` });
        node.warn(`${friendlyName} detected person, but not dark. Ignoring automation. ` + duskStats);
        return [null, null, { payload: { message: 'Automation ignored: not dark', duskStats } }];
    }
}
// Garage door opening: turn on lights and start timer if lights are off
if (entityId === 'cover.north_garage_door' && isStateTransition(oldState, newState) && newState === 'opening' && lightsState === 'off') {
    const friendlyName = getFriendlyName(msg);
    if (isDark) {
        flow.set(DURATION_KEY, BASE_TIMER_MS);
        flow.set(TIMER_KEY, now + BASE_TIMER_MS);
        flow.set('garage_lights_just_automated', true); // Set automation flag
        node.status({ fill: 'green', shape: 'dot', text: 'Garage opening, lights ON, timer start' });
        node.log(`${friendlyName} opening - turning on garage lights and starting timer`);
        return [buildTriggerMsg(BASE_TIMER_MS, msg.garage, msg.garage_lights, msg.override), {
            payload: {
                action: "light.turn_on",
                data: {},
                target: {
                    entity_id: "light.north_garage_lights"
                }
            }
        }, null];
    } else {
        const duskStats = duskStatus(nowDate, sunTimes);
        node.status({ fill: 'grey', shape: 'ring', text: `Not dark: ${duskStats}` });
        node.warn(`${friendlyName} opening, but not dark. Ignoring automation. ` + duskStats);
        return [null, null, { payload: { message: 'Automation ignored: not dark', duskStats } }];
    }
}
// North Garage Door (to house): turn on lights and start timer when door opens
if (entityId === 'binary_sensor.north_garage' && isStateTransition(oldState, newState)) {
    const friendlyName = getFriendlyName(msg);
    if (newState === 'on') {
        // Door opened
        if (isDark) {
            flow.set(DURATION_KEY, BASE_TIMER_MS);
            flow.set(TIMER_KEY, now + BASE_TIMER_MS);
            flow.set('garage_lights_just_automated', true); // Set automation flag
            node.status({ fill: 'orange', shape: 'dot', text: 'House door opened, lights ON, timer start' });
            node.log(`${friendlyName} opened - turning on garage lights and starting timer`);
            return [buildTriggerMsg(BASE_TIMER_MS, msg.garage, msg.garage_lights, msg.override), {
                payload: {
                    action: "light.turn_on",
                    data: {},
                    target: {
                        entity_id: "light.north_garage_lights"
                    }
                }
            }, null];
        } else {
            const duskStats = duskStatus(nowDate, sunTimes);
            node.status({ fill: 'grey', shape: 'ring', text: `Not dark: ${duskStats}` });
            node.warn(`${friendlyName} opened, but not dark. Ignoring automation. ` + duskStats);
            return [null, null, { payload: { message: 'Automation ignored: not dark', duskStats } }];
        }
    } else if (newState === 'off') {
        // Door closed - just log, no action needed
        node.debug(`${friendlyName} closed, no action taken`);
        return [null, null, null];
    }
}
// Reset timer ONLY if this is a garage door close event
if (entityId === 'cover.north_garage_door' && isStateTransition(oldState, newState) && newState === 'closed') {
    const friendlyName = getFriendlyName(msg);
    flow.set(TIMER_KEY, null);
    flow.set(DURATION_KEY, BASE_TIMER_MS);
    node.status({ fill: 'grey', shape: 'dot', text: 'Garage closed, timer reset' });
    node.log(`${friendlyName} closed - resetting timer and turning off lights`);
    // Only send turn_off if lights are currently on
    let toOff = null;
    if (lightsState === 'on') {
        toOff = {
            payload: {
                action: "light.turn_off",
                data: {},
                target: {
                    entity_id: "light.north_garage_lights"
                }
            }
        };
    }
    return [buildResetMsg(msg.garage, msg.garage_lights, msg.override), toOff];
}
// Reset timer if lights are turned off
if (lightsState === 'off') {
    flow.set(TIMER_KEY, null);
    flow.set(DURATION_KEY, BASE_TIMER_MS);
    node.status({ fill: 'grey', shape: 'dot', text: 'Lights off, timer reset' });
    return [buildResetMsg(msg.garage, msg.garage_lights, msg.override), null];
}

// Person detection: extend timer if detection and lights are on (using any person detection)
if (isAnyPersonDetected && lightsState === 'on') {
    const friendlyName = getFriendlyName(msg);
    let duration = flow.get(DURATION_KEY) || BASE_TIMER_MS;
    duration = Math.min(duration + INCREMENT_MS, MAX_TIMER_MS);
    flow.set(DURATION_KEY, duration);
    flow.set(TIMER_KEY, now + duration);
    node.status({ fill: 'blue', shape: 'dot', text: `Person detected, timer extended: ${(duration/60000).toFixed(0)} min` });
    node.log(`${friendlyName} detected person - extending timer to ${(duration/60000).toFixed(0)} minutes`);
    return [buildTriggerMsg(duration, msg.garage, msg.garage_lights, msg.override), null];
}
// Garage open and lights on: start/extend timer
if (garageState === 'open' && lightsState === 'on' && !flow.get(TIMER_KEY)) {
    let duration = flow.get(DURATION_KEY) || BASE_TIMER_MS;
    flow.set(TIMER_KEY, now + duration);
    node.status({ fill: 'green', shape: 'dot', text: `Garage open, timer started: ${(duration/60000).toFixed(0)} min` });
    return [buildTriggerMsg(duration, msg.garage, msg.garage_lights, msg.override), null];
}
// Timer expiry: if this is a loopback from the trigger node
if (msg.trigger_off === true) {
    flow.set(TIMER_KEY, null);
    flow.set(DURATION_KEY, BASE_TIMER_MS);
    node.status({ fill: 'red', shape: 'dot', text: 'Timer expired, lights OFF' });
    node.log('Timer expired - turning off garage lights');
    // Send turn off command out output 2
    return [null, {
        payload: {
            action: "light.turn_off",
            data: {},
            target: {
                entity_id: "light.north_garage_lights"
            }
        }
    }];
}
// Otherwise, do nothing, but do not clear status
node.debug(`No automation action taken for ${entityId}: ${oldState} -> ${newState}`, msg);
return [null, null];
