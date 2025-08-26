<!-- markdownlint-disable MD033 MD041 MD036 MD022 MD032 MD013 MD031 -->

<div align="center">

# 🔔 Node-RED Alarm Notifications

<img src="https://img.shields.io/badge/Node--RED-8F0000?style=for-the-badge&logo=nodered&logoColor=white" alt="Node-RED">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Home_Assistant-41BDF5?style=for-the-badge&logo=home-assistant&logoColor=white" alt="Home Assistant">

<br>

**⚡ Smart, multi-platform notification system for home security alarms**

<p align="center">
  <img src="https://img.shields.io/badge/status-production_ready-brightgreen" alt="Status">
  <img src="https://img.shields.io/badge/platforms-Android_|_iOS-blue" alt="Platforms">
  <img src="https://img.shields.io/badge/notifications-Push_|_TTS-orange" alt="Types">
</p>

</div>

---

## 🚀 Features

<table>
<tr>
<td width="50%">

### 📱 **Multi-Platform Support**
- ✅ **Android** notifications with rich formatting
- ✅ **iOS** notifications with critical alerts
- ✅ **Cross-platform** HTML/plain text handling
- ✅ **Device arrays** for multi-device users

</td>
<td width="50%">

### 🔊 **Smart TTS System**
- ✅ **Text-to-Speech** for immediate alerts
- ✅ **Audio streaming** with priority levels
- ✅ **Home state** awareness
- ✅ **Quiet hours** support (planned)

</td>
</tr>
<tr>
<td width="50%">

### ⚙️ **Environment Driven**
- ✅ **JSON configuration** via environment variables
- ✅ **Hot-swappable** notification maps
- ✅ **Centralized settings** management
- ✅ **No hard-coded** device IDs

</td>
<td width="50%">

### 🛡️ **Robust & Reliable**
- ✅ **Error handling** with comprehensive logging
- ✅ **State validation** and graceful failures
- ✅ **Duplicate prevention** (planned)
- ✅ **Performance optimized**

</td>
</tr>
</table>

---

## 📋 Alarm States & Notifications

<div align="center">

| 🟡 **Pending** | 🔴 **Triggered** | 🟢 **Disabled** |
|:---:|:---:|:---:|
| System is arming<br>*Disarm now* | **ALARM ACTIVATED**<br>*Immediate attention* | System is safe<br>*Welcome home* |
| Push + TTS | Push + TTS | Push + TTS |
| Home users only | **All users** | Home users only |

</div>

---

## 🗂️ File Structure

```
notify/
├── 📄 disabled_push_mobile.js      # Push notifications when alarm disabled
├── 📄 disabled_tts_mobile.js       # TTS announcements when alarm disabled  
├── 📄 pending_push_mobile.js       # Push notifications when alarm pending
├── 📄 pending_tts_mobile.js        # TTS announcements when alarm pending
├── 📄 triggered_push_mobile.js     # Push notifications when alarm triggered
├── 📄 triggered_tts_mobile.js      # TTS announcements when alarm triggered
├── 📄 pending_tts_startup.js       # [DEPRECATED] Legacy global setup
├── 🔧 .env                         # Environment variables configuration
├── 📚 IMPROVEMENT_ROADMAP.md       # Future enhancements & ChatGPT feedback
└── 📖 README.md                    # This file
```

<details>
<summary><b>📂 Example Files (Development)</b></summary>

```
├── 📄 disabled_push_mobile_improved.js    # Enhanced version with better error handling
├── 📄 example_cached_notification.js      # Performance caching example
└── 📄 settings_helper_example.js          # functionGlobalContext helper functions
```

</details>

---

## ⚙️ Configuration

### 🌍 Environment Variables

Configure your notification system via `.env` file or Node-RED environment settings:

<details>
<summary><b>🔧 Device Mapping (Click to expand)</b></summary>

```bash
# Android Device Mapping
NOTIFY_MAP_ANDROID={
  "person.quentin": [
    "notify.mobile_app_quentin_s25u",
    "notify.mobile_app_quentin_g7u"
  ],
  "person.alana": "notify.mobile_app_alana_s22u",
  "person.betty": "notify.mobile_app_betty_s24u"
}

# iOS Device Mapping  
NOTIFY_MAP_IOS={
  "person.quentin": "notify.mobile_app_quentin_ipad_pro_13",
  "garage_notify": "notify.mobile_app_quentin_ipad_pro_13"
}
```

</details>

<details>
<summary><b>💬 Message Templates (Click to expand)</b></summary>

```bash
# Alarm State Messages
ALARM_TRIGGERED_PUSH="🚨 SECURITY SYSTEM TRIGGERED! Check immediately!"
ALARM_TRIGGERED_TTS="Attention! The security system has been triggered!"

ALARM_PENDING_PUSH="⏰ DISARM THE ALARM NOW"
ALARM_PENDING_TTS="The security system is armed. Please disarm the alarm."

ALARM_DISABLED_PUSH="✅ Security system disabled. Welcome home!"
ALARM_DISABLED_TTS="The security system has been disabled. You can relax now."
```

</details>

---

## 🔌 Node-RED Integration

### 📥 Input Message Format

```javascript
{
  "data": {
    "entity_id": "person.quentin",
    "state": "home"
  },
  "push_text": "Custom notification text (optional)",
  "tts_text": "Custom TTS text (optional)",
  "alarm": {
    "message": "Additional context (optional)"
  }
}
```

### 📤 Output Message Format

```javascript
[
  {
    "payload": {
      "action": "notify.mobile_app_quentin_s25u",
      "data": {
        "message": "🚨 SECURITY SYSTEM TRIGGERED!",
        "title": "ALARM ACTIVATED",
        "data": {
          "priority": "high",
          "persistent": true,
          "clickAction": "/lovelace-kiosk/Alarm"
          // ... platform-specific options
        }
      }
    }
  }
]
```

---

## 🎯 Platform Differences

<table>
<tr>
<th width="50%">🤖 Android</th>
<th width="50%">🍎 iOS</th>
</tr>
<tr>
<td>

```javascript
// Rich HTML formatting
message: "🚨<b>ALARM TRIGGERED</b>🚨"

// Android-specific features
data: {
  sticky: true,
  chronometer: true,
  notification_icon: "mdi:alarm-light",
  color: "#ff0000"
}
```

</td>
<td>

```javascript
// Plain text only
message: "🚨ALARM TRIGGERED🚨"

// iOS-specific features  
data: {
  push: {
    sound: { critical: 1, volume: 1.0 },
    "interruption-level": "time-sensitive"
  }
}
```

</td>
</tr>
</table>

---

## 🚦 Usage Examples

### 🟡 Pending Alarm Flow

```
[State Change] → [Function: pending_push_mobile.js] → [Home Assistant Service Call]
      ↓
  person.quentin 
  state: "home"
      ↓
  Sends push notification:
  "⏰ DISARM THE ALARM NOW"
```

### 🔴 Triggered Alarm Flow

```
[Alarm Trigger] → [Function: triggered_tts_mobile.js] → [TTS Service Call]
      ↓
  person.* (ALL USERS)
      ↓
  Plays TTS announcement:
  "Attention! Security system triggered!"
```

---

## 🔮 Roadmap & Improvements

<div align="center">

| 🎯 **Phase 1** | 🚀 **Phase 2** | ✨ **Phase 3** |
|:---:|:---:|:---:|
| Security & Stability | Reliability | Nice-to-Have |
| • HTML escaping<br>• Cooldown system<br>• Quiet hours | • Enhanced parsing<br>• Data type fixes<br>• Message limits | • Config externalization<br>• Enhanced tagging<br>• Observability |

</div>

See **[IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md)** for detailed enhancement plans.

---

## 🔧 Development

### 🧪 Testing Your Changes

1. **Copy** a script to Node-RED function node
2. **Configure** environment variables in flow settings
3. **Test** with sample input message:
   ```javascript
   {
     "data": {
       "entity_id": "person.test_user", 
       "state": "home"
     }
   }
   ```
4. **Check** Node-RED debug panel for output

### 📝 Best Practices

- ✅ Always validate `msg.data` exists
- ✅ Use try-catch for error handling
- ✅ Log meaningful debug information
- ✅ Follow JSDoc comment standards
- ✅ Test with both Android and iOS devices

---

<div align="center">

## 📞 Support

<table border="0">
<tr>
<td align="center">

**🐛 Found a Bug?**<br>
Open an issue with steps to reproduce

</td>
<td align="center">

**💡 Have an Idea?**<br>
Check the roadmap or suggest new features

</td>
<td align="center">

**🤝 Want to Contribute?**<br>
PRs welcome! Follow the coding standards

</td>
</tr>
</table>

---

<img src="https://img.shields.io/badge/Made_with-❤️_and_☕-red?style=for-the-badge" alt="Made with love">

**Built for reliable home automation • Tested in production • Continuously improved**

</div>
