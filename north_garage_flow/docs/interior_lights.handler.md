# North Garage Interior Lights Handler

## Overview

This document describes the logic and usage of the `interior_lights.handler.js` Node-RED function, which automates the North Garage interior lights based on person detection, garage/house door events, and override conditions.

---

## Purpose

- Automatically turns on and off the garage interior lights based on activity and time of day.
- Manages a timer to keep lights on after activity is detected.
- Allows for an override to prevent automation from turning off the lights.
- Only automates lights between dusk and dawn (when it is dark).

---

## Key Features

- **Configurable Timers:**
  - Base timer: 10 minutes
  - Each person detection: +2 minutes (up to 30 minutes max)
- **Override Support:**
  - If override is active, the timer is reset and automation is disabled.
- **Person Detection:**
  - Turns on lights and starts/extends timer if a person is detected by interior or exterior cameras.
- **Garage Door Events:**
  - Turns on lights and starts timer when the garage door is opening.
- **House Door Events:**
  - Turns on lights and starts timer when the North Garage door to the house is opened.
- **Light State Events:**
  - Starts timer if lights are manually turned on.
  - Resets timer if lights are turned off.
- **SunCalc Integration:**
  - Automation only runs between dusk and dawn (when it is dark).
- **Timer Expiry:**
  - Turns off lights when the timer expires.

---

## Inputs

- `msg.garage.message`: Current state of the garage door (`open`, `closed`, etc.).
- `msg.garage_lights.message`: Current state of the garage lights (`on` or `off`).
- `msg.override.message`: If `'on'`, disables automation.
- `msg.topic`: Used to detect person sensors, garage/house door, or light events.
- `msg.payload`: State or event payload.

---

## Outputs

- **Output 1:**
  - Timer/trigger messages for downstream nodes (e.g., to start or extend the timer).
- **Output 2:**
  - Light control commands (turn on/off) for the garage lights.
- **Output 3:**
  - Status messages (e.g., when automation is ignored due to daylight).

---

## Flow Context Keys

- `garage_lights_timer_expiry`: Timestamp when the timer should expire.
- `garage_lights_timer_duration`: Current timer duration in ms.

---

## Status Indicators

- **Blue:** Person detected, lights on, timer started/extended.
- **Green:** Garage opening, lights on, timer started.
- **Orange:** House door opened, lights on, timer started.
- **Red:** Timer expired, lights off.
- **Yellow:** Override active, timer reset.
- **Grey:** Lights off or automation ignored (e.g., not dark).

---

## Example Scenarios

- **Person detected (dark):** Lights turn on and timer starts/extends.
- **Garage door opens (dark):** Lights turn on and timer starts.
- **House door opens (dark):** Lights turn on and timer starts.
- **Lights manually turned on:** Timer starts.
- **Lights turned off:** Timer resets.
- **Override activated:** Timer resets and automation is disabled.
- **Timer expires:** Lights turn off automatically.
- **Daylight:** Automation is ignored; lights are not turned on automatically.

---

## Notes

- Designed for use in Node-RED with Home Assistant events and SunCalc for dusk/dawn calculations.
- All timer and state management is handled via Node-RED flow context.
- Only relevant events (person, garage/house door, light state) affect the timer and automation.

---

## File Location

- `north_garage/interior_lights.handler.js`

---

## Author

- Quentin King
- Last updated: June 27, 2025
