# North Garage Interior Lights Handler

## Overview

This document describes the logic and usage of the `interior_lights.handler.js` Node-RED function, which automates the North Garage interior lights based on person detection, garage/house door events, and override conditions. The script uses proper state transition detection and comprehensive logging following Node-RED function node best practices.

---

## Purpose

- Automatically turns on and off the garage interior lights based on activity and time of day.
- Manages a timer to keep lights on after activity is detected.
- Allows for an override to prevent automation from turning off the lights.
- Only automates lights between dusk and dawn (when it is dark) using SunCalc integration.
- Uses proper state transition detection to avoid false triggers from repeated state reports.

---

## Key Features

- **State Transition Detection:**
  - Only responds to actual state changes (e.g., `off -> on`, `on -> off`)
  - Ignores repeated state reports that don't represent actual changes
  - Uses Home Assistant's rich event data for accurate triggering
- **Configurable Timers:**
  - Base timer: 10 minutes
  - Each person detection: +2 minutes (up to 30 minutes max)
- **Enhanced Logging:**
  - `node.log()` for important automation events
  - `node.warn()` for expected conditions that prevent automation
  - `node.debug()` for non-critical information and flow control
  - `node.error()` for unexpected errors with fallback behavior
  - Uses friendly names from Home Assistant for better readability
- **Override Support:**
  - If override is active, the timer is reset and automation is disabled.
- **Person Detection:**
  - Turns on lights and starts/extends timer if a person is detected by interior or exterior cameras.
  - Only triggers on actual detection events (state transitions)
- **Garage Door Events:**
  - Turns on lights and starts timer when the garage door is opening.
- **House Door Events:**
  - Turns on lights and starts timer when the North Garage door to the house is opened.
- **Light State Events:**
  - Starts timer if lights are manually turned on.
  - Resets timer if lights are turned off.
  - Detects automation vs. manual activation
- **SunCalc Integration:**
  - Automation only runs between dusk and dawn (when it is dark).
  - Error handling with fallback behavior if SunCalc fails
- **Timer Expiry:**
  - Turns off lights when the timer expires.

---

## Inputs

### Message Structure

The script expects messages from Home Assistant with the following structure:

- **New State (Trigger Event):**
  - `msg.topic`: Entity ID that triggered the event
  - `msg.payload`: New state value
  - `msg.data.event.old_state.state`: Previous state value
  - `msg.data.event.new_state.attributes.friendly_name`: Human-readable name

- **Current States (Context):**
  - `msg.garage.message`: Current state of the garage door (`open`, `closed`, etc.).
  - `msg.garage_lights.message`: Current state of the garage lights (`on` or `off`).
  - `msg.override.message`: If `'on'`, disables automation.

### Supported Entity Types

- `light.north_garage_lights`: Garage light state changes
- `binary_sensor.g5_flex_north_garage_person_detected`: Interior camera person detection
- `binary_sensor.g5_bullet_drive_north_person_detected`: Exterior camera person detection
- `cover.north_garage_door`: Garage door state changes
- `binary_sensor.north_garage`: House door to garage state changes

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
- `garage_lights_just_automated`: Flag to distinguish automation vs. manual light activation.

---

## Helper Functions

The script includes several helper functions for improved maintainability:

- `isStateTransition(oldState, newState)`: Checks if an actual state change occurred
- `getFriendlyName(msg)`: Extracts human-readable entity names from Home Assistant data
- `buildTriggerMsg()`: Creates timer trigger messages with consistent structure
- `buildResetMsg()`: Creates timer reset messages with consistent structure
- `duskStatus()`: Formats dusk/dawn time information for debugging

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

### Typical Automation Flows

- **Person detected (dark):** Camera detects person → lights turn on → timer starts/extends.
- **Garage door opens (dark):** Door opening event → lights turn on → timer starts.
- **House door opens (dark):** House door opening → lights turn on → timer starts.
- **Manual light activation:** Light turned on manually → timer starts for auto-off.
- **Light turned off:** Any light off event → timer resets.
- **Override activated:** Override switch on → timer resets → automation disabled.
- **Timer expires:** No activity for timer duration → lights turn off automatically.

### Edge Cases Handled

- **Daylight automation:** Events during daylight are logged but ignored.
- **Repeated state reports:** Only actual state transitions trigger actions.
- **SunCalc errors:** Fallback behavior allows automation to continue.
- **Missing data:** Graceful handling of malformed messages.
- **Automation vs. manual:** Distinguishes between automated and manual light activation.

---

## Notes

- Designed for use in Node-RED with Home Assistant events and SunCalc for dusk/dawn calculations.
- All timer and state management is handled via Node-RED flow context.
- Only actual state transitions trigger automation actions, preventing false triggers.
- Comprehensive logging follows Node-RED function node best practices.
- Error handling includes fallback behavior for robust operation.
- Uses friendly names from Home Assistant for improved debugging and monitoring.
- SunCalc module should be added to Node-RED function node setup (no `require` needed).

---

## Recent Improvements

### State Transition Detection

The script now properly analyzes Home Assistant event data to distinguish between:

- Actual state changes (`off -> on`, `on -> off`)
- Repeated state reports (same state reported multiple times)

This prevents false triggers and improves automation reliability.

### Enhanced Logging Strategy

Implements comprehensive logging following Node-RED best practices:

- **Important events:** `node.log()` for key automation actions
- **Expected warnings:** `node.warn()` for daylight conditions
- **Debug info:** `node.debug()` for flow control and non-critical events
- **Error handling:** `node.error()` with graceful fallback behavior

### Better Message Structure Handling

- Extracts rich data from Home Assistant events
- Uses friendly names for better readability
- Handles malformed or incomplete messages gracefully

---

## File Location

- `north_garage/interior_lights.handler.js`

---

## Author

- Quentin King
- Last updated: July 12, 2025
