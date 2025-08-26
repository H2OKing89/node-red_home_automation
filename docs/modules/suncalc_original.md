# SunCalc Usage in Node-RED Automations

This document explains how to use the [`suncalc`](https://github.com/mourner/suncalc) library for sun position and time calculations in Node-RED JavaScript function nodes, with a focus on Home Assistant and lighting automations.

---

## What is `suncalc`?

- **SunCalc** is a lightweight JavaScript library for calculating sun phases (dawn, dusk, sunrise, sunset, etc.) and sun position for any date and location.
- Useful for automations that should only run when it's dark, or for scheduling actions based on daylight.

---

## Why Use SunCalc in Node-RED?

- Automate lights, notifications, or other actions based on whether it's currently dark or light outside.
- Avoid hardcoding times for dusk/dawn—automatically adapts to seasons and location.
- Example: Only turn on garage lights between dusk and dawn.

---

## How to Use in Node-RED Function Nodes

> **Note:** When you add `suncalc` as a module in a Node-RED function node’s Setup tab, you do **not** need to use `require`. The module is automatically available as a global variable—use `suncalc` directly in your code.

---

## Example Usage in Node-RED Function Node

Reference: See `north_garage_flow/interior_lights.handler.js` for a real-world example.

```javascript
// Access suncalc directly (no require needed)
const nowDate = new Date();
const LAT = 40.854118;
const LON = -96.717293;
const sunTimes = suncalc.getTimes(nowDate, LAT, LON);
const isDark = nowDate < sunTimes.dawn || nowDate > sunTimes.dusk;

if (isDark) {
    // Run night-time automation
}
```

- `suncalc.getTimes(date, latitude, longitude)` returns an object with times for dawn, sunrise, sunset, dusk, etc.
- Compare `nowDate` to `sunTimes.dawn` and `sunTimes.dusk` to determine if it's dark.

---

## Standard Operating Procedures & Examples

### 1. Basic Setup Template

Every Node-RED function using SunCalc should follow this template:

```javascript
// === SunCalc Configuration ===
const nowDate = new Date();
const LAT = 40.854118;  // Replace with your latitude
const LON = -96.717293; // Replace with your longitude

// === Calculate Sun Times ===
let sunTimes, isDark;
try {
    sunTimes = suncalc.getTimes(nowDate, LAT, LON);
    isDark = nowDate < sunTimes.dawn || nowDate > sunTimes.dusk;
} catch (error) {
    node.error('Failed to calculate sun times: ' + error.message, msg);
    // Fallback behavior
    isDark = true; // or false, depending on fail-safe preference
    sunTimes = { dawn: new Date(), dusk: new Date() };
}

// === Your automation logic here ===
if (isDark) {
    // Night-time automation
} else {
    // Day-time behavior
}
```

### 2. Logging & Status Helper Function

Use this helper function for consistent debug output across all SunCalc implementations:

```javascript
// Helper for dusk/dawn status logging
function duskStatus(nowDate, sunTimes) {
    return `Now: ${nowDate.toLocaleTimeString()} | Dusk: ${sunTimes.dusk.toLocaleTimeString()} | Dawn: ${sunTimes.dawn.toLocaleTimeString()}`;
}

// Usage examples:
node.warn(`Not dark enough for automation. ${duskStatus(nowDate, sunTimes)}`);
node.status({ fill: 'grey', shape: 'ring', text: `Not dark: ${duskStatus(nowDate, sunTimes)}` });
```

### 3. Complete Lighting Automation Example

```javascript
// === Standard SunCalc Setup ===
const nowDate = new Date();
const LAT = 40.854118;
const LON = -96.717293;

let sunTimes, isDark;
try {
    sunTimes = suncalc.getTimes(nowDate, LAT, LON);
    isDark = nowDate < sunTimes.dawn || nowDate > sunTimes.dusk;
} catch (error) {
    node.error('SunCalc error: ' + error.message, msg);
    isDark = true; // Fail-safe: allow automation
    sunTimes = { dawn: new Date(), dusk: new Date() };
}

// === Motion Detection Automation ===
const isMotionDetected = msg.payload === 'on' && msg.topic === 'binary_sensor.motion_sensor';
const lightsCurrentlyOff = msg.lights_state === 'off';

if (isMotionDetected && lightsCurrentlyOff) {
    if (isDark) {
        // Turn on lights during dark hours
        node.log('Motion detected during dark hours - turning on lights');
        node.status({ fill: 'blue', shape: 'dot', text: 'Motion: Lights ON (dark)' });
        
        return {
            payload: {
                action: "light.turn_on",
                target: { entity_id: "light.room_lights" }
            }
        };
    } else {
        // Skip automation during daylight
        const statusText = `Motion: Skipped (daylight) - ${sunTimes.dusk.toLocaleTimeString()}`;
        node.warn(`Motion detected but it's daylight. Dusk at: ${sunTimes.dusk.toLocaleTimeString()}`);
        node.status({ fill: 'yellow', shape: 'ring', text: statusText });
        
        return null;
    }
}

return null;
```

### 4. Advanced: Multiple Light Conditions

```javascript
// === SunCalc Setup ===
const nowDate = new Date();
const LAT = 40.854118;
const LON = -96.717293;

let sunTimes, lightCondition;
try {
    sunTimes = suncalc.getTimes(nowDate, LAT, LON);
    
    // Define multiple light conditions
    if (nowDate < sunTimes.dawn || nowDate > sunTimes.dusk) {
        lightCondition = 'dark';
    } else if (nowDate < sunTimes.sunrise || nowDate > sunTimes.sunset) {
        lightCondition = 'twilight';
    } else {
        lightCondition = 'daylight';
    }
} catch (error) {
    node.error('SunCalc error: ' + error.message, msg);
    lightCondition = 'dark'; // Fail-safe
    sunTimes = { dawn: new Date(), dusk: new Date(), sunrise: new Date(), sunset: new Date() };
}

// === Conditional Automation Based on Light Level ===
switch (lightCondition) {
    case 'dark':
        // Full brightness automation
        node.log('Dark conditions - full automation active');
        break;
    case 'twilight':
        // Dim lighting automation
        node.log('Twilight conditions - dim automation active');
        break;
    case 'daylight':
        // No lighting automation
        node.warn('Daylight conditions - automation disabled');
        return null;
}
```

### 5. Error Handling & Validation Template

```javascript
// === Robust SunCalc Implementation ===
function getSunConditions(lat, lon) {
    const nowDate = new Date();
    
    // Validate coordinates
    if (typeof lat !== 'number' || typeof lon !== 'number') {
        throw new Error(`Invalid coordinates: lat=${lat}, lon=${lon}`);
    }
    
    if (lat < -90 || lat > 90) {
        throw new Error(`Invalid latitude: ${lat} (must be -90 to 90)`);
    }
    
    if (lon < -180 || lon > 180) {
        throw new Error(`Invalid longitude: ${lon} (must be -180 to 180)`);
    }
    
    try {
        const sunTimes = suncalc.getTimes(nowDate, lat, lon);
        const isDark = nowDate < sunTimes.dawn || nowDate > sunTimes.dusk;
        
        return {
            success: true,
            isDark: isDark,
            sunTimes: sunTimes,
            nowDate: nowDate,
            statusText: `Now: ${nowDate.toLocaleTimeString()} | Dusk: ${sunTimes.dusk.toLocaleTimeString()} | Dawn: ${sunTimes.dawn.toLocaleTimeString()}`
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            isDark: true, // Fail-safe default
            sunTimes: null,
            nowDate: nowDate
        };
    }
}

// === Usage ===
const sunData = getSunConditions(40.854118, -96.717293);

if (!sunData.success) {
    node.error(`SunCalc failed: ${sunData.error}`, msg);
}

if (sunData.isDark) {
    // Your automation logic
    node.status({ fill: 'blue', shape: 'dot', text: sunData.statusText });
}
```

---

## Best Practices

- Always use accurate latitude and longitude for your location.
- Use SunCalc for all dusk/dawn logic instead of hardcoded times.
- For debugging, log or display the calculated dusk/dawn times in Node-RED status/debug nodes.
- See the [official SunCalc documentation](https://github.com/mourner/suncalc#sun-times) for all available phases (e.g., nautical, civil, night).
- **Always implement error handling** with try/catch blocks and meaningful fallback behavior.
- **Use consistent logging patterns** across all implementations for easier debugging.
- **Validate coordinates** to prevent runtime errors in production environments.
- **Consider fail-safe defaults** - decide whether automation should be enabled or disabled when SunCalc fails.

---

## Real-World Script Reference

- [`north_garage_flow/interior_lights.handler.js`](../north_garage_flow/interior_lights.handler.js):
  - Uses SunCalc to only automate garage lights when it's dark (between dusk and dawn).
  - Example status/debug output: `Now: 9:15:00 PM | Dusk: 8:45:00 PM | Dawn: 5:10:00 AM`

---

## References

- [SunCalc documentation](https://github.com/mourner/suncalc)
- [SunCalc on npm](https://www.npmjs.com/package/suncalc)
- [NOAA Solar Calculator](https://www.esrl.noaa.gov/gmd/grad/solcalc/)

---

<!-- Last updated: July 15, 2025 -->
