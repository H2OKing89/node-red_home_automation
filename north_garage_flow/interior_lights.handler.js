// Node-RED function: Garage Interior Lights Automation with Timer
// Outputs: [toTrigger, toOff]

// === Configurable Timer Settings ===
const BASE_TIMER_MS = 10 * 60 * 1000; // 10 minutes
const INCREMENT_MS = 2 * 60 * 1000;   // +2 minutes per detection
const MAX_TIMER_MS = 30 * 60 * 1000;  // Max 30 minutes

// === Context Keys ===
const TIMER_KEY = 'garage_lights_timer_expiry';
const DURATION_KEY = 'garage_lights_timer_duration';

// === Helper: Get current time ===
const now = Date.now();

// Check if automation just triggered a light on
let justAutomated = flow.get('garage_lights_just_automated') || false;

const garageState = msg.garage && msg.garage.message;
const lightsState = msg.garage_lights && msg.garage_lights.message;
const override = msg.override && msg.override.message === 'on';

const INTERIOR_CAM = 'binary_sensor.g5_flex_north_garage_person_detected';
const EXTERIOR_CAM = 'binary_sensor.g5_bullet_drive_north_person_detected';

const isInteriorPerson = msg.topic === INTERIOR_CAM && msg.payload === 'on';
const isExteriorPerson = msg.topic === EXTERIOR_CAM && msg.payload === 'on';

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

// Ignore state report messages for "on" (except for "off" which is handled below)
if (msg.topic === 'light.north_garage_lights' && msg.payload === 'on') {
    // If the old state was 'off' and new state is 'on', start the timer (manual or external turn-on)
    if (msg.data && msg.data.event && msg.data.event.old_state && msg.data.event.old_state.state === 'off' && msg.data.event.new_state && msg.data.event.new_state.state === 'on') {
        if (justAutomated) {
            // This was triggered by automation, not manual
            flow.set('garage_lights_just_automated', false);
            node.status({ fill: 'green', shape: 'dot', text: 'Garage opening, lights ON, timer start' });
            return [null, null]; // Already handled by automation, do not start timer again
        } else {
            flow.set(DURATION_KEY, BASE_TIMER_MS);
            flow.set(TIMER_KEY, now + BASE_TIMER_MS);
            node.status({ fill: 'blue', shape: 'ring', text: 'Manual lights on, timer start' });
            return [buildTriggerMsg(BASE_TIMER_MS, msg.garage, msg.garage_lights, msg.override), null];
        }
    }
    // Otherwise, ignore repeated 'on' state reports
    node.status({ fill: 'grey', shape: 'ring', text: 'State report: lights on (ignored)' });
    return [null, null];
}

// === SunCalc: Only allow automation to turn on lights between dusk and dawn ===
const nowDate = new Date();
const LAT = 40.854118;
const LON = -96.717293;
const sunTimes = suncalc.getTimes(nowDate, LAT, LON);
const isDark = nowDate < sunTimes.dawn || nowDate > sunTimes.dusk;

// Helper for dusk/dawn status
function duskStatus(nowDate, sunTimes) {
    return `Now: ${nowDate.toLocaleTimeString()} | Dusk: ${sunTimes.dusk.toLocaleTimeString()} | Dawn: ${sunTimes.dawn.toLocaleTimeString()}`;
}

// Interior camera: turn on lights and start/extend timer if detection and lights are off
if (isInteriorPerson && lightsState === 'off') {
    if (isDark) {
        flow.set(DURATION_KEY, BASE_TIMER_MS);
        flow.set(TIMER_KEY, now + BASE_TIMER_MS);
        flow.set('garage_lights_just_automated', true); // Set automation flag
        node.status({ fill: 'blue', shape: 'dot', text: 'Interior person, lights ON, timer start' });
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
        node.debug('Interior person detected, but not dark. Ignoring automation. ' + duskStats);
        return [null, null, { payload: { message: 'Automation ignored: not dark', duskStats } }];
    }
}
// Garage door opening: turn on lights and start timer if lights are off
if (msg.topic === 'cover.north_garage_door' && msg.payload === 'opening' && lightsState === 'off') {
    if (isDark) {
        flow.set(DURATION_KEY, BASE_TIMER_MS);
        flow.set(TIMER_KEY, now + BASE_TIMER_MS);
        flow.set('garage_lights_just_automated', true); // Set automation flag
        node.status({ fill: 'green', shape: 'dot', text: 'Garage opening, lights ON, timer start' });
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
        node.debug('Garage opening, but not dark. Ignoring automation. ' + duskStats);
        return [null, null, { payload: { message: 'Automation ignored: not dark', duskStats } }];
    }
}
// North Garage Door (to house): turn on lights and start timer when door opens, do nothing when closes
if (msg.topic === 'binary_sensor.north_garage') {
    if (msg.payload === 'on') {
        if (isDark) {
            flow.set(DURATION_KEY, BASE_TIMER_MS);
            flow.set(TIMER_KEY, now + BASE_TIMER_MS);
            flow.set('garage_lights_just_automated', true); // Set automation flag
            node.status({ fill: 'orange', shape: 'dot', text: 'House door opened, lights ON, timer start' });
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
            node.debug('House door opened, but not dark. Ignoring automation. ' + duskStats);
            return [null, null, { payload: { message: 'Automation ignored: not dark', duskStats } }];
        }
    } else {
        node.debug('House door closed, no action taken');
        return [null, null, null];
    }
}
// Reset timer ONLY if this is a garage door close event
if (msg.topic === 'cover.north_garage_door' && msg.payload === 'closed') {
    flow.set(TIMER_KEY, null);
    flow.set(DURATION_KEY, BASE_TIMER_MS);
    node.status({ fill: 'grey', shape: 'dot', text: 'Garage closed (payload), timer reset' });
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
// Interior or exterior camera: extend timer if detection and lights are on
if ((isInteriorPerson || isExteriorPerson) && lightsState === 'on') {
    let duration = flow.get(DURATION_KEY) || BASE_TIMER_MS;
    duration = Math.min(duration + INCREMENT_MS, MAX_TIMER_MS);
    flow.set(DURATION_KEY, duration);
    flow.set(TIMER_KEY, now + duration);
    node.status({ fill: 'blue', shape: 'dot', text: `Person detected, timer extended: ${(duration/60000).toFixed(0)} min` });
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
node.debug('No automation action taken for message:', msg);
return [null, null];
