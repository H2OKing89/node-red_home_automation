# North Garage Cover State Handler

## Overview

This document describes the logic and usage of the `cover_state.handler.js` Node-RED function, which manages the automation of the North Garage door (cover) based on state changes, person detection, and override conditions.

---

## Purpose

- Automatically manages a timer to close the garage door after it has been opened.
- Extends the timer if a person is detected or if the house door is opened.
- Allows for an override to prevent automatic closing.
- Provides status updates for downstream automation nodes.

---

## Key Features

- **Configurable Timers:**
  - Base timer: 15 minutes
  - Each person detection or house door event: +2 minutes (up to 30 minutes max)
- **Override Support:**
  - If override is active, the timer is reset and auto-close is disabled.
- **Person Detection:**
  - Extends the timer if a person is detected while the garage is open.
- **House Door Event:**
  - Extends the timer if the North Garage door to the house is opened while the garage is open.
- **Light Events:**
  - Light state changes are ignored for timer logic.
- **Timer Expiry:**
  - When the timer expires, sends a command to close the garage door and logs how long it was open.
- **Garage Closed:**
  - Resets the timer and state when the garage is closed.

---

## Inputs

- `msg.garage.message`: Current state of the garage door (`open` or `closed`).
- `msg.override.message`: If `'on'`, disables auto-close.
- `msg.topic`: Used to detect person sensors, house door, or light events.
- `msg.payload`: Fallback for garage state.

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

## Status Indicators

- **Blue:** Timer extended due to person detection.
- **Orange:** Timer extended due to house door event.
- **Green:** Timer started when garage opened.
- **Red:** Timer expired, closing garage.
- **Yellow:** Override active, timer reset.
- **Grey:** Garage closed, timer reset or person detected but garage not open.

---

## Example Scenarios

- **Garage opens:** Timer starts for 15 minutes.
- **Person detected:** Timer extends by 2 minutes (up to 30 minutes max).
- **House door opens:** Timer extends by 2 minutes (up to 30 minutes max).
- **Override activated:** Timer is reset and auto-close is disabled.
- **Garage closes:** Timer and state are reset.
- **Timer expires:** Garage door is closed automatically.

---

## Notes

- Designed for use in Node-RED with Home Assistant events.
- All timer and state management is handled via Node-RED flow context.
- Only relevant events (person, house door, garage state) affect the timer.

---

## File Location

- `north_garage/cover_state.handler.js`

---

## Author

- Quentin King
- Last updated: June 27, 2025
