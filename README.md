# Node-RED Home Automation: The Ultimate Smart Home Brain

Welcome to Quentin’s Node-RED automation suite—a comprehensive, modular, and highly-customized smart home system. This repository powers everything from advanced alarm logic and garage automation to weather alerting, lighting, and rich notifications. It’s built for flexibility, reliability, and deep Home Assistant integration.

---

## What’s Inside?

- **Alarm System:**  
  Robust state management, duress code support, lock-based disarming, and instant push/TTS notifications. Handles edge cases and failures gracefully.

- **Garage Automation:**  
  Smart timers for auto-closing, motion-activated lighting, and detailed documentation for every logic path.

- **Weather Alerts:**  
  Priority-based filtering, deduplication, and time-aware delivery. Alerts are spoken on Sonos/Google Home and sent to mobile devices, with rich formatting for Pushover and Gotify.

- **General Notifications:**  
  Unified push and TTS for all critical events—alarms, doors, weather, and more. Home Assistant events are the backbone.

- **Config & Utilities:**  
  Centralized global config, easy migration tools, and per-flow documentation for rapid onboarding and troubleshooting.

---

## Directory Highlights

- `alarm_flow/` — Alarm logic, duress handling, lock disarm, and notification modules.
- `north_garage_flow/` — Garage door and lighting automations, with docs.
- `weather_flow/` — Weather alert processing, notification handlers, and time-based logic.
- `config/` — Global settings and context.
- `sync_global_json.py` — Utility for syncing Node-RED global config.

---

## Why This Repo?

- **Battle-Tested:**  
  Handles real-world edge cases, failures, and complex automations.
- **Extensible:**  
  Add new flows, integrations, or notification channels with minimal friction.
- **Documented:**  
  Each major flow has markdown docs for setup, logic, and integration tips.
- **Customizable:**  
  Tweak counties, alert sounds, notification services, and time restrictions to fit your needs.

---

## Getting Started

1. Clone the repo and import flows into Node-RED.
2. Configure Home Assistant nodes, device/entity IDs, and notification services.
3. Adjust timers, thresholds, and logic as needed.
4. Test with sample payloads and deploy.

---

## Requirements

- Node-RED (latest recommended)
- Home Assistant (event integration)
- [Optional] SunCalc, Moment.js, Pushover, Gotify, Sonos, Google Home

---

## License

MIT License

---

## Author

Quentin King  
*Last updated: June 29, 2025*

---

*Questions or ideas? Open an issue or PR—let’s automate everything!*
