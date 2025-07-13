# North Garage Cover State Handler

## Overview

This document describes the logic and usage of the `cover_state.handler.js` Node-RED function, which manages the automation of the North Garage door (cover) based on state changes, person detection, and override conditions. The script uses proper state transition detection and comprehensive logging following Node-RED function node best practices.

---

## Purpose

- Automatically manages a timer to close the garage door after it has been opened.
- Extends the timer if a person is detected or if the house door is opened.
- Allows for an override to prevent automatic closing.
- Provides status updates for downstream automation nodes.
- Uses proper state transition detection to avoid false triggers from repeated state reports.

---

## Key Features

- **State Transition Detection:**
  - Only responds to actual state changes (e.g., `off -> on`, `on -> off`)
  - Ignores repeated state reports that don't represent actual changes
  - Uses Home Assistant's rich event data for accurate triggering
- **Configurable Timers:**
  - Base timer: 15 minutes
  - Each person detection or house door event: +2 minutes (up to 30 minutes max)
- **Enhanced Logging:**
  - `node.log()` for important automation events (timer actions, garage close commands)
  - `node.warn()` for expected conditions that prevent automation (override active)
  - `node.debug()` for non-critical information and flow control
  - `node.error()` for unexpected errors that need attention
  - Uses friendly names from Home Assistant for better readability
- **Override Support:**
  - If override is active, the timer is reset and auto-close is disabled.
- **Person Detection:**
  - Extends the timer if a person is detected while the garage is open.
  - Only triggers on actual detection events (state transitions)
- **House Door Events:**
  - Extends the timer if the North Garage door to the house is opened while the garage is open.
  - Only responds to actual door state transitions
- **Light Events:**
  - Light state changes are ignored for timer logic.
- **Garage Door State Events:**
  - Properly handles garage door state transitions with enhanced logging
- **Timer Expiry:**
  - When the timer expires, sends a command to close the garage door and logs how long it was open.
- **Garage Closed:**
  - Resets the timer and state when the garage is closed.

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

- `binary_sensor.g5_flex_north_garage_person_detected`: Interior camera person detection
- `binary_sensor.g5_bullet_drive_north_person_detected`: Exterior camera person detection
- `cover.north_garage_door`: Garage door state changes
- `binary_sensor.north_garage`: House door to garage state changes
- `light.north_garage_lights`: Garage light state changes (ignored for timer logic)

---

## Outputs

- **Output 1:**
  - Timer/trigger messages for downstream nodes (e.g., to start or extend the timer).
- **Output 2:**
  - Close command for the garage door (when timer expires).
- **Output 3:**
  - Status messages (e.g., when the garage is closed by timer).

---

## Flow Context Keys

- `garage_timer_expiry`: Timestamp when the timer should expire.
- `garage_timer_duration`: Current timer duration in ms.
- `garage_opened_at`: Timestamp when the garage was last opened.

---

## Helper Functions

The script includes several helper functions for improved maintainability:

- `isStateTransition(oldState, newState)`: Checks if an actual state change occurred
- `getFriendlyName(msg)`: Extracts human-readable entity names from Home Assistant data
- `buildTriggerMsg()`: Creates timer trigger messages with consistent structure
- `buildResetMsg()`: Creates timer reset messages with consistent structure

---

## Status Indicators

- **Blue:** Timer extended due to person detection (includes entity name).
- **Orange:** Timer extended due to house door event (shows door state).
- **Green:** Timer started when garage opened.
- **Red:** Timer expired, closing garage.
- **Yellow:** Override active, timer reset.
- **Grey:** Garage closed, timer reset or person detected but garage not open.

---

## Example Scenarios

### Typical Automation Flows

- **Garage opens:** Timer starts for 15 minutes.
- **Person detected (garage open):** Timer extends by 2 minutes (up to 30 minutes max).
- **House door opens/closes (garage open):** Timer extends by 2 minutes (up to 30 minutes max).
- **Override activated:** Timer is reset and auto-close is disabled.
- **Garage closes:** Timer and state are reset.
- **Timer expires:** Garage door is closed automatically.

### Edge Cases Handled

- **Repeated state reports:** Only actual state transitions trigger timer extensions.
- **Person detection when garage closed:** No timer action, appropriate status message.
- **Override conditions:** All automation is properly disabled when override is active.
- **Missing data:** Graceful handling of malformed messages.
- **Light state changes:** Explicitly ignored for garage timer logic.

---

## Notes

- Designed for use in Node-RED with Home Assistant events.
- All timer and state management is handled via Node-RED flow context.
- Only actual state transitions trigger timer extensions, preventing false triggers.
- Comprehensive logging follows Node-RED function node best practices.
- Error handling includes fallback behavior for robust operation.
- Uses friendly names from Home Assistant for improved debugging and monitoring.
- Only relevant events (person detection, house door, garage state) affect the timer.

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
- **Expected warnings:** `node.warn()` for override conditions
- **Debug info:** `node.debug()` for flow control and non-critical events
- **Error handling:** `node.error()` with graceful fallback behavior

### Better Message Structure Handling

- Extracts rich data from Home Assistant events
- Uses friendly names for better readability
- Handles malformed or incomplete messages gracefully
- Specific entity ID constants for improved reliability

### Improved Entity Handling

- Uses specific entity ID matching instead of pattern matching
- Better separation of concerns for different entity types
- More precise event filtering and processing

---

## File Location

- `north_garage/cover_state.handler.js`

---

## Author

- Quentin King
- Last updated: July 13, 2025
