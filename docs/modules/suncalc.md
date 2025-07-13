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

## Best Practices

- Always use accurate latitude and longitude for your location.
- Use SunCalc for all dusk/dawn logic instead of hardcoded times.
- For debugging, log or display the calculated dusk/dawn times in Node-RED status/debug nodes.
- See the [official SunCalc documentation](https://github.com/mourner/suncalc#sun-times) for all available phases (e.g., nautical, civil, night).

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

<!-- Last updated: June 29, 2025 -->
