# Node-RED Function: Home Assistant User ID to Alarm Code Disarm Script

## Overview

This Node-RED function node listens for Home Assistant lock events, matches the Home Assistant user ID (HA user ID) to a user code from a global user-whitelist, and sends a disarm command to the alarm system. It is designed for robust, secure, and auditable alarm deactivation based on user identity.

---

## Purpose

- **Automate alarm disarming** when a recognized user unlocks a smart lock (e.g., garage deadbolt) via Home Assistant.
- **Ensure only authorized users** (by HA user ID) can trigger alarm disarm.
- **Centralize user code management** using a global user-whitelist (file context).
- **Provide detailed logging** for troubleshooting and auditing.

---

## How It Works

1. **Listens for lock events** from Home Assistant (e.g., "Unlocked by [HA_USER_ID] User Name").
2. **Parses the event** to extract the action (e.g., "unlocked") and the user source (HA user ID and name).
3. **Loads the user-whitelist** from Node-RED global context (file storage), mapping HA user IDs to alarm codes.
4. **Matches the HA user ID** from the event to the whitelist. If found, retrieves the associated alarm code.
5. **Sends a disarm command** to the alarm system with the correct code and entity ID, in the exact format required by the Home Assistant node.
6. **Logs all steps** at configurable log levels (DEBUG, INFO, WARN, ERROR).

---

## Configuration

- **User Whitelist:**
  - Stored in Node-RED global context (file mode) as `user-whitelist`.
  - Each entry must have: `user_code` (alarm code), `enabled` (true/false), and the HA user ID as the key.
- **Environment Variables:**
  - `FALLBACK_ALARM_CODE`: Default code if user-specific code is missing (default: `1437`).
  - `NON_USER_SOURCES`: Comma-separated list of sources that should NOT trigger disarm (e.g., `rf,manual`).
  - `EVENT_STATE_REGEX`: Regex for parsing event state (default covers standard formats).
  - `ALARM_CODE_REGEX`: Regex for validating alarm codes (default: 4+ digits).
- **Alarm Entity ID:**
  - Set in Node-RED context as `alarmEntityId` (default: `alarm_control_panel.alarmo`).
- **Log Level:**
  - Set in the script (`Logger` class) to control verbosity. Change to `INFO` or `WARN` for less output.

---

## Expected Input

- **Payload Example:**

  ```json
  {
    "topic": "input_text.garage_deadbolt_status",
    "payload": "Unlocked by [2e64d5e38cab42a08ea8a3a15d2713f0] Quentin King",
    "data": {
      "event": {
        "new_state": {
          "state": "Unlocked by [2e64d5e38cab42a08ea8a3a15d2713f0] Quentin King"
        }
      }
    }
  }
  ```

- **Legacy Format:**
  - "Unlocked by User Name" (no HA user ID) is ignored for security.

---

## Output (Success)

- **Payload Format:**

  ```json
  {
    "action": "alarmo.disarm",
    "data": {
      "code": "9482",
      "entity_id": "alarm_control_panel.alarmo"
    }
  }
  ```

- **Note:** The structure must match exactly. No extra keys or nesting.

---

## Logging & Troubleshooting

- All major steps are logged with timestamps and log levels.
- Adjust log level in the script for more or less verbosity.
- Errors are sent to output #2 with details for debugging.

---

## Best Practices

- **Always use HA user IDs** for user-code mapping. Do not rely on names for security.
- **Keep the user-whitelist up to date** and store it in file context for persistence.
- **Test with real events** to ensure correct parsing and code dispatch.
- **Review logs** for any skipped or failed actions.

---

## Maintenance

- Update the user-whitelist in Node-RED global context as users are added/removed.
- Review and adjust environment variables as needed for your installation.
- Update the script if Home Assistant event formats change.

---

## Authors & Version

- **Author:** Quentin King
- **Version:** 2.3.0 (2025-06-21)
- **Contact:** [Your Contact Info]

---

## Example User Whitelist (global context, file mode)

```json
{
  "2e64d5e38cab42a08ea8a3a15d2713f0": {
    "full_name": "Quentin King",
    "user_code": "9482",
    "enabled": true
  },
  "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6": {
    "full_name": "Dan Bienka",
    "user_code": "1234",
    "enabled": true
  }
}
```

---

## See Also

- Home Assistant automation for lock event reporting (ensure it outputs HA user ID)
- Node-RED documentation on global context and file storage

---

*This documentation is suitable for the Node-RED Note tab or as a standalone markdown file.*
