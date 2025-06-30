# Node-RED Automation Workspace

Alright, let’s combine and **upgrade** these into a single README that covers your whole Node-RED automation setup—including your next-level weather alert flows and all your home automation wizardry.
You want something that’s organized, covers all the features, and still readable for mere mortals. Here’s a merge draft (ready to drop into your main README):

---

This repo is Quentin’s smart home brain: a full set of Node-RED flows, custom function code, and integrations for *everything*—alarms, garage doors, weather, lighting, and wild custom notifications. It’s Home Assistant on steroids. Use it as a toolbox, reference, or springboard for your own automations.

---

## Directory Structure

```text
.
├── alarm_flow/
│   ├── lock_disable_alarm/   # Disarm alarms via lock code
│   └── notify/               # Alarm notification handlers
├── config/                   # Global context and settings
├── north_garage_flow/
│   └── doc/                  # Garage automation docs
├── weather_flow/
│   ├── notify/               # Weather notification handlers
│   ├── priority_alerts.js    # Assigns priorities, dedupes, validates alerts
│   ├── process_alert_tts.js  # TTS announcement logic (Sonos/Google Home)
│   ├── process_alert_tts_mobile.js # Mobile device TTS via Home Assistant
│   ├── pushover_alert.js     # Pushover rich notifications (HTML/emoji/sounds)
│   ├── gotify_alert.js       # Gotify markdown notifications (meta/county)
│   └── time_condition.js     # Restrict notifications by time, critical bypass
└── sync_global_json.py       # Utility: Sync global config
```

---

## Features

### Alarm System

* Advanced alarm state management, duress code handling, event failure detection
* Disarm via lock code
* Instant push & TTS notifications for all states

### Garage Automation

* Timer-based auto-close for garage doors
* Interior lighting by motion, time, or events
* Documentation for all logic

### Weather Alert Flow

* **Priority Assignment:** Assigns priorities to NWS alerts (Tornado, Severe, etc.), supports multiple/duplicate filtering with TTL
* **TTS Announcements:** Weather alerts on Sonos, Google Home, and mobile devices. Speaks only the *relevant* details (no “Des Moines, Iowa” nonsense)
* **Rich Notifications:**

  * **Pushover:** Length-limited, emoji, HTML, custom sound
  * **Gotify:** Markdown, event art, highlights, meta
* **Time Restrictions:** Don’t want flood alerts waking you at 2 AM? Restrict by hour, with critical overrides for stuff like Tornado Warnings
* **Flexible Filtering:** Target your county, tune sounds, choose device lists, all in config

### General Notifications

* Push and TTS for everything important: alarms, doors, weather, the works
* Home Assistant events as the backbone

---

## Getting Started

1. **Clone the Repo**

   ```bash
   git clone H2OKing89/node-red_automations
   ```

2. **Import Flows**

   * Bring flows/functions into Node-RED
3. **Configure Integrations**

   * Hook up Home Assistant nodes, set up device/entity IDs in configs
   * Customize sounds, counties, notification services (Pushover, Gotify, etc.)
4. **Deploy & Test**

   * Tweak timers, thresholds, and logic as needed
   * Use sample alert payloads to test your notification stack

---

## Customization Tips

* **Counties:** Edit `targetCounties` arrays for your area
* **Alert Sounds:** Set up in TTS config
* **Notification Services:** Drop in your own tokens/IDs
* **Time Restrictions:** Adjust allowed hours in `time_condition.js`
* **Garage/Alarm Logic:** Tweak timers and triggers for your setup

---

## Requirements

* Node-RED (latest recommended)
* Home Assistant (event integration required)
* \[Optional] SunCalc for sunrise/sunset logic
* \[Optional] Moment.js for advanced time stuff
* \[Optional] Pushover, Gotify, Sonos, Google Home integrations

---

## Docs

* Each major flow/automation has a markdown in its `doc/` folder with setup, logic, and integration tips.

---

## Additional Tools

* `sync_global_json.py` — Easy sync for Node-RED global config, handy for migrations/backups

---

## License

MIT License

---

## Author

Quentin King
*Last updated: June 27, 2025*

---

*Questions, ideas, or bug reports? Open an issue or a PR—let’s automate all the things!*
