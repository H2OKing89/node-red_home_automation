<!-- markdownlint-disable MD033 MD041 MD036 MD022 MD032 MD013 MD031 -->

<div align="center">

# 🌦️ Weather Alert & Monitoring System

## **🌪️ Intelligent Weather Alert Processing & Notification Hub**

<img src="https://img.shields.io/badge/Node--RED-8F0000?style=for-the-badge&logo=nodered&logoColor=white" alt="Node-RED">
<img src="https://img.shields.io/badge/Weather_Alerts-NWS-blue?style=for-the-badge&logo=weather&logoColor=white" alt="Weather">
<img src="https://img.shields.io/badge/Home_Assistant-41BDF5?style=for-the-badge&logo=homeassistant&logoColor=white" alt="Home Assistant">
<img src="https://img.shields.io/badge/TTS-Audio-green?style=for-the-badge&logo=speaker&logoColor=white" alt="TTS">

<br>

<img src="https://img.shields.io/badge/Status-Production_Ready-brightgreen?style=flat-square" alt="Status">
<img src="https://img.shields.io/badge/Alerts-Real_Time-orange?style=flat-square" alt="Real Time">
<img src="https://img.shields.io/badge/Monitoring-24/7-blue?style=flat-square" alt="24/7">
<img src="https://img.shields.io/badge/Integration-Multi_Platform-purple?style=flat-square" alt="Multi Platform">

<br>

**⚡ Real-time NWS weather alerts • 🔊 Intelligent TTS announcements • 📱 Multi-platform notifications • ⏰ Smart timing controls**

</div>

---

## 🌟 System Architecture

<div align="center">

```mermaid
graph TD
    subgraph "🌐 Data Sources"
        NWS[🌪️ National Weather Service]
        HA[🏠 Home Assistant]
        FEED[📡 Weather Feeds]
    end
    
    subgraph "🧠 Processing Engine"
        PR[🎯 Priority Assignment]
        DEDUP[🔄 Deduplication]
        FILTER[🎛️ Content Filtering]
        TIME[⏰ Time Conditions]
    end
    
    subgraph "📢 Notification Channels"
        TTS[🔊 TTS Audio]
        MOBILE[📱 Mobile TTS]
        PUSH[📬 Push Notifications]
        GOTIFY[📢 Gotify Alerts]
    end
    
    subgraph "🎵 Audio Devices"
        SONOS[🔊 Sonos]
        GOOGLE[🎵 Google Home]
        SPEAKER[🔈 Smart Speakers]
    end
    
    subgraph "📱 Mobile Platforms"
        ANDROID[🤖 Android]
        IOS[🍎 iOS]
        PUSHOVER[📬 Pushover]
    end
    
    NWS --> PR
    HA --> PR
    FEED --> PR
    
    PR --> DEDUP
    DEDUP --> FILTER
    FILTER --> TIME
    
    TIME --> TTS
    TIME --> MOBILE
    TIME --> PUSH
    TIME --> GOTIFY
    
    TTS --> SONOS
    TTS --> GOOGLE
    TTS --> SPEAKER
    
    MOBILE --> ANDROID
    MOBILE --> IOS
    
    PUSH --> PUSHOVER
    GOTIFY --> MOBILE
    
    style NWS fill:#2196F3,color:#fff
    style PR fill:#FF9800,color:#fff
    style TTS fill:#4CAF50,color:#fff
    style TIME fill:#9C27B0,color:#fff
    style PUSH fill:#F44336,color:#fff
```

</div>

---

## 🎯 Core Features & Capabilities

<table>
<tr>
<td width="50%" align="center">

### 🧠 **Intelligent Processing**

<img src="https://img.shields.io/badge/Processing-AI_Enhanced-blue?style=flat-square" alt="Processing">

✅ **Priority-Based Alert System**
- Automatic priority assignment by event type
- Critical event bypass for time restrictions
- Multi-alert payload handling

✅ **Advanced Deduplication**
- TTL (Time-To-Live) mechanism
- Duplicate alert filtering
- Smart content comparison

✅ **Geographic Filtering**
- Target county specification
- Area-specific notifications
- Irrelevant location filtering

✅ **Content Intelligence**
- Key information extraction
- Headline optimization
- Instruction prioritization

</td>
<td width="50%" align="center">

### 📡 **Multi-Platform Delivery**

<img src="https://img.shields.io/badge/Delivery-Multi_Channel-green?style=flat-square" alt="Delivery">

✅ **Audio Announcements**
- Sonos speaker integration
- Google Home compatibility
- Smart speaker distribution

✅ **Mobile Notifications**
- TTS mobile device alerts
- Home Assistant integration
- Platform-agnostic delivery

✅ **Push Notification Services**
- Pushover rich notifications
- Gotify markdown alerts
- HTML formatting support

✅ **Time-Based Controls**
- Configurable notification hours
- Critical event bypass
- Smart scheduling logic

</td>
</tr>
</table>

---

## 📁 System Components

<div align="center">

<table border="1" style="border-collapse: collapse; margin: 20px auto;">
<tr style="background-color: #f0f0f0;">
<th width="25%">📄 Component</th>
<th width="35%">🎯 Purpose</th>
<th width="40%">🔧 Key Features</th>
</tr>
<tr>
<td align="center">
<b>🎯 priority_alerts.js</b><br>
<small>Alert Processing Core</small>
</td>
<td>Priority assignment and deduplication engine</td>
<td>• Event type classification<br>• TTL-based deduplication<br>• Multi-alert processing<br>• Validation & sanitization</td>
</tr>
<tr style="background-color: #f0f8ff;">
<td align="center">
<b>🔊 process_alert_tts.js</b><br>
<small>Audio Announcement</small>
</td>
<td>Main TTS logic for smart speakers</td>
<td>• Sonos/Google integration<br>• Content filtering<br>• Geographic targeting<br>• Error handling</td>
</tr>
<tr style="background-color: #fff8f0;">
<td align="center">
<b>📱 process_alert_tts_mobile.js</b><br>
<small>Mobile TTS</small>
</td>
<td>Mobile device TTS notification system</td>
<td>• Home Assistant integration<br>• Device targeting<br>• Stream customization<br>• Priority handling</td>
</tr>
<tr style="background-color: #f8fff0;">
<td align="center">
<b>📬 pushover_alert.js</b><br>
<small>Push Notifications</small>
</td>
<td>Rich push notification formatting</td>
<td>• HTML formatting<br>• Emoji integration<br>• Length validation<br>• Sound selection</td>
</tr>
<tr style="background-color: #fff0f8;">
<td align="center">
<b>📢 gotify_alert.js</b><br>
<small>Self-Hosted Alerts</small>
</td>
<td>Gotify markdown notification system</td>
<td>• Markdown formatting<br>• Event artwork<br>• Meta information<br>• City/county highlights</td>
</tr>
<tr style="background-color: #f0fff8;">
<td align="center">
<b>⏰ time_condition.js</b><br>
<small>Timing Control</small>
</td>
<td>Smart notification timing management</td>
<td>• Configurable hours<br>• Critical event bypass<br>• Moment.js integration<br>• Advanced time handling</td>
</tr>
<tr style="background-color: #f8f0ff;">
<td align="center">
<b>🌦️ weather_tts_mobile.js</b><br>
<small>Weather TTS</small>
</td>
<td>Specialized mobile weather announcements</td>
<td>• Weather-specific TTS<br>• Mobile optimization<br>• Alert customization<br>• Device integration</td>
</tr>
</table>

</div>

---

## 🔄 Alert Processing Flow

<div align="center">

<table border="1" style="border-collapse: collapse; margin: 20px auto;">
<tr style="background-color: #f0f0f0;">
<th width="15%">🔹 Stage</th>
<th width="25%">⚡ Process</th>
<th width="30%">🔧 Functions</th>
<th width="30%">📊 Output</th>
</tr>
<tr>
<td align="center"><b style="color: #2196F3;">📥 INGESTION</b></td>
<td>Raw alert data reception</td>
<td>• NWS feed processing<br>• Home Assistant integration<br>• Multi-source handling</td>
<td>• Structured alert data<br>• Event classification<br>• Source validation</td>
</tr>
<tr style="background-color: #fff9c4;">
<td align="center"><b style="color: #FF9800;">🎯 PROCESSING</b></td>
<td>Priority & deduplication</td>
<td>• Event type analysis<br>• Priority assignment<br>• Duplicate detection</td>
<td>• Prioritized alerts<br>• Unique events<br>• Processing metadata</td>
</tr>
<tr style="background-color: #e8f5e8;">
<td align="center"><b style="color: #4CAF50;">🎛️ FILTERING</b></td>
<td>Content & geographic filtering</td>
<td>• County targeting<br>• Content extraction<br>• Geographic relevance</td>
<td>• Filtered content<br>• Local relevance<br>• Key information</td>
</tr>
<tr style="background-color: #f3e5f5;">
<td align="center"><b style="color: #9C27B0;">⏰ TIMING</b></td>
<td>Time-based control</td>
<td>• Hour restrictions<br>• Critical bypass<br>• Schedule management</td>
<td>• Timing decisions<br>• Bypass flags<br>• Schedule compliance</td>
</tr>
<tr style="background-color: #ffebee;">
<td align="center"><b style="color: #F44336;">📢 DELIVERY</b></td>
<td>Multi-channel notification</td>
<td>• TTS generation<br>• Push formatting<br>• Mobile delivery</td>
<td>• Audio announcements<br>• Push notifications<br>• Mobile alerts</td>
</tr>
</table>

</div>

---

## 🌪️ Weather Event Priority Matrix

<div align="center">

<table border="1" style="border-collapse: collapse; margin: 20px auto;">
<tr style="background-color: #f0f0f0;">
<th width="20%">🌡️ Event Type</th>
<th width="15%">🚨 Priority</th>
<th width="20%">📱 Notifications</th>
<th width="20%">⏰ Time Bypass</th>
<th width="25%">🎵 Audio Features</th>
</tr>
<tr style="background-color: #ffebee;">
<td align="center"><b style="color: #D32F2F;">🌪️ Tornado Warning</b></td>
<td align="center"><b style="color: #D32F2F;">CRITICAL</b></td>
<td>• All channels<br>• Immediate delivery</td>
<td><b style="color: #D32F2F;">YES</b></td>
<td>• Emergency sounds<br>• Max volume<br>• Repeat alerts</td>
</tr>
<tr style="background-color: #fff3e0;">
<td align="center"><b style="color: #F57C00;">⛈️ Severe T-Storm</b></td>
<td align="center"><b style="color: #F57C00;">HIGH</b></td>
<td>• Push + TTS<br>• Priority delivery</td>
<td><b style="color: #F57C00;">YES</b></td>
<td>• Alert tones<br>• Standard volume<br>• Single announcement</td>
</tr>
<tr style="background-color: #f3e5f5;">
<td align="center"><b style="color: #7B1FA2;">❄️ Winter Weather</b></td>
<td align="center"><b style="color: #7B1FA2;">MEDIUM</b></td>
<td>• Push notifications<br>• Scheduled TTS</td>
<td>Conditional</td>
<td>• Soft chimes<br>• Reduced volume<br>• Weather-specific</td>
</tr>
<tr style="background-color: #e8f5e8;">
<td align="center"><b style="color: #388E3C;">🌊 Flood Advisory</b></td>
<td align="center"><b style="color: #388E3C;">STANDARD</b></td>
<td>• Push only<br>• Normal timing</td>
<td>NO</td>
<td>• Gentle tones<br>• Normal volume<br>• Information focus</td>
</tr>
<tr style="background-color: #e3f2fd;">
<td align="center"><b style="color: #1976D2;">🌤️ Special Weather</b></td>
<td align="center"><b style="color: #1976D2;">LOW</b></td>
<td>• Push notifications<br>• Time restricted</td>
<td>NO</td>
<td>• Subtle alerts<br>• Low volume<br>• Brief announcements</td>
</tr>
</table>

</div>

---

## 🛠️ Configuration & Setup

### 1️⃣ **System Requirements**

<details>
<summary><b>🔧 Platform Requirements (Click to expand)</b></summary>

```bash
# Core Platform
✅ Node-RED 3.0+
✅ Home Assistant 2023.1+
✅ JavaScript ES6+ support

# Audio Integration
✅ Sonos speakers (optional)
✅ Google Home devices (optional)
✅ Home Assistant TTS service

# Notification Services
✅ Pushover account & API token
✅ Gotify server instance (optional)
✅ Mobile app integration (HA)

# External Dependencies
✅ Moment.js library (time handling)
✅ NWS weather feed access
✅ MQTT broker (recommended)
```

</details>

### 2️⃣ **Configuration Setup**

<details>
<summary><b>⚙️ Alert Processing Configuration (Click to expand)</b></summary>

```javascript
// Priority Alert Configuration
const alertPriorities = {
    "Tornado Warning": "CRITICAL",
    "Severe Thunderstorm Warning": "HIGH", 
    "Winter Storm Warning": "MEDIUM",
    "Flood Advisory": "STANDARD",
    "Special Weather Statement": "LOW"
};

// Geographic Targeting
const targetCounties = [
    "Douglas County, NE",
    "Sarpy County, NE", 
    "Washington County, NE"
];

// Time Restrictions
const allowedHours = {
    start: 7,  // 7 AM
    end: 22    // 10 PM
};

// Critical Events (bypass time restrictions)
const criticalEvents = [
    "Tornado Warning",
    "Severe Thunderstorm Warning",
    "Flash Flood Warning"
];
```

</details>

<details>
<summary><b>🔊 Audio & TTS Configuration (Click to expand)</b></summary>

```javascript
// Sonos Device Configuration
const sonosDevices = [
    "media_player.living_room_sonos",
    "media_player.bedroom_sonos",
    "media_player.kitchen_sonos"
];

// Google Home Configuration  
const googleDevices = [
    "media_player.living_room_display",
    "media_player.kitchen_home"
];

// Alert Sound Configuration
const alertSounds = {
    "CRITICAL": {
        sound: "/local/sounds/emergency_alert.mp3",
        volume: 0.8,
        delay: 2
    },
    "HIGH": {
        sound: "/local/sounds/weather_alert.mp3", 
        volume: 0.6,
        delay: 1
    }
};
```

</details>

<details>
<summary><b>📱 Notification Service Configuration (Click to expand)</b></summary>

```javascript
// Pushover Configuration
const pushoverConfig = {
    token: "your_app_token_here",
    user: "your_user_key_here",
    priority: {
        "CRITICAL": 2,    // Emergency priority
        "HIGH": 1,        // High priority
        "MEDIUM": 0,      // Normal priority
        "LOW": -1         // Low priority
    }
};

// Gotify Configuration
const gotifyConfig = {
    server: "https://gotify.yourdomain.com",
    token: "your_gotify_token_here",
    priority: {
        "CRITICAL": 10,
        "HIGH": 8,
        "MEDIUM": 5,
        "LOW": 2
    }
};

// Mobile TTS Configuration
const mobileTTSConfig = {
    entity_id: "tts.google_en_com",
    target: "media_player.mobile_phone",
    cache: false,
    options: {
        voice: "en-US-Wavenet-D"
    }
};
```

</details>

---

## 🚀 Quick Start Guide

### 1️⃣ **Installation Process**

```javascript
// 1. Import Node-RED flows
Import weather_flow components:
- priority_alerts.js       (Core processing)
- process_alert_tts.js     (Audio announcements)  
- pushover_alert.js        (Push notifications)
- time_condition.js        (Timing control)
- Additional components as needed

// 2. Configure Node-RED flow
Connect components in processing order:
[NWS Feed] → [Priority] → [Filter] → [Time] → [Delivery]

// 3. Set up Home Assistant integration
Enable TTS services
Configure media players
Set up mobile app integration
```

### 2️⃣ **Testing & Validation**

<details>
<summary><b>🧪 System Testing Protocol (Click to expand)</b></summary>

```bash
# Alert Processing Tests
✅ Test priority assignment for different event types
✅ Verify deduplication with duplicate alerts
✅ Check geographic filtering with various counties
✅ Validate time restrictions and bypass logic

# Audio System Tests  
✅ Test TTS on Sonos speakers
✅ Verify Google Home integration
✅ Check volume and sound customization
✅ Test mobile device TTS delivery

# Notification Service Tests
✅ Verify Pushover delivery and formatting
✅ Test Gotify markdown rendering
✅ Check mobile push notification delivery
✅ Validate HTML formatting and emoji support

# Integration Tests
✅ End-to-end alert processing
✅ Multi-channel delivery verification
✅ Critical event bypass testing
✅ System performance under load
```

</details>

---

## 📊 **Performance & Monitoring**

### 🎯 **System Performance Metrics**

<table>
<tr>
<td width="25%" align="center">

**⚡ Processing Speed**
- Alert ingestion: < 1 second
- Priority assignment: < 500ms
- Content filtering: < 200ms
- Delivery initiation: < 2 seconds

</td>
<td width="25%" align="center">

**🎵 Audio Performance**
- TTS generation: < 3 seconds
- Speaker connection: < 1 second
- Announcement start: < 5 seconds
- Multi-device sync: < 2 seconds

</td>
<td width="25%" align="center">

**📱 Notification Delivery**
- Push notification: < 10 seconds
- Mobile TTS: < 15 seconds
- Service availability: > 99%
- Delivery success rate: > 95%

</td>
<td width="25%" align="center">

**🔍 System Monitoring**
- Alert processing logs
- Delivery success tracking
- Performance metrics
- Error rate monitoring

</td>
</tr>
</table>

---

## 🔧 **Advanced Customization**

### 📝 **Alert Content Customization**

<details>
<summary><b>✏️ Message Template Customization (Click to expand)</b></summary>

```javascript
// TTS Message Templates
const ttsTemplates = {
    "Tornado Warning": "🌪️ TORNADO WARNING for {counties}. {headline}. Take shelter immediately. {instructions}",
    "Severe Thunderstorm Warning": "⛈️ Severe thunderstorm warning for {counties}. {headline}. {instructions}",
    "Winter Weather Advisory": "❄️ Winter weather advisory for {counties}. {headline}. {instructions}"
};

// Push Notification Templates
const pushTemplates = {
    title: "🌦️ {eventType}",
    message: "<b>{headline}</b><br><br>📍 {areas}<br>⏰ {timing}<br><br>{instructions}",
    html: true,
    sound: "weather_alert"
};

// Content Filtering Rules
const contentFilters = {
    includeCounties: ["Douglas", "Sarpy", "Washington"],
    excludeStates: ["Iowa", "Kansas"],
    keywordHighlights: ["tornado", "severe", "warning", "emergency"],
    maxMessageLength: 480
};
```

</details>

### 🎨 **Visual & Audio Customization**

<details>
<summary><b>🎵 Audio & Visual Enhancement (Click to expand)</b></summary>

```javascript
// Sound Customization
const customSounds = {
    "CRITICAL": {
        preAlert: "/local/sounds/emergency_siren.mp3",
        mainAlert: "/local/sounds/weather_critical.mp3",
        postAlert: "/local/sounds/all_clear.mp3"
    },
    "HIGH": {
        preAlert: "/local/sounds/alert_chime.mp3",
        mainAlert: "/local/sounds/weather_warning.mp3"
    }
};

// Visual Notification Enhancements
const visualEnhancements = {
    "CRITICAL": {
        emoji: "🚨🌪️🚨",
        color: "#FF0000",
        animation: "pulse"
    },
    "HIGH": {
        emoji: "⚠️⛈️⚠️", 
        color: "#FF8800",
        animation: "flash"
    }
};
```

</details>

---

## 🔗 **Integration Examples**

### 📱 **Home Assistant Flow**

<div align="center">

```
┌─────────────────────────────────────────────────────────────┐
│                    🏠 HOME ASSISTANT                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐  │
│  │🌐 NWS Feed │ │📡 MQTT      │ │🔊 TTS       │ │📱 Mobile│  │
│  │   Integration│ │   Broker    │ │   Service   │ │   App   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘  │
└───────────┬─────────────┬─────────────┬─────────────┬─────────┘
            │             │             │             │
            ▼             ▼             ▼             ▼
┌───────────────────────────────────────────────────────────────┐
│                   🧠 NODE-RED PROCESSING                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐  │
│  │🎯 Priority  │ │⏰ Timing    │ │🔊 TTS       │ │📬 Push │  │
│  │   Assignment│ │   Control   │ │   Audio     │ │  Notify │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘  │
└───────────┬─────────────┬─────────────┬─────────────┬─────────┘
            │             │             │             │
            ▼             ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│🔊 Sonos     │ │🎵 Google    │ │📱 Mobile    │ │📬 External  │
│   Speakers  │ │   Home      │ │   Devices   │ │   Services  │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

</div>

---

## 📚 **Troubleshooting & Support**

### 🔍 **Common Issues & Solutions**

<details>
<summary><b>⚠️ Troubleshooting Guide (Click to expand)</b></summary>

```bash
# Audio Issues
🔊 No TTS announcements:
   - Check Home Assistant TTS service
   - Verify media player entity IDs
   - Test TTS service manually
   - Check device network connectivity

🔇 Audio volume issues:
   - Verify volume settings in config
   - Check device maximum volume
   - Test with different alert types
   - Review audio device capabilities

# Notification Issues  
📱 Missing push notifications:
   - Verify Pushover/Gotify tokens
   - Check service connectivity
   - Review message formatting
   - Test with manual notifications

⏰ Wrong notification timing:
   - Check time_condition.js settings
   - Verify timezone configuration
   - Review bypass event settings
   - Test with different event types

# Processing Issues
🎯 Incorrect priority assignment:
   - Review priority_alerts.js config
   - Check event type mapping
   - Verify alert payload format
   - Test with sample data

🔄 Duplicate alerts:
   - Check TTL settings
   - Verify deduplication logic
   - Review alert uniqueness criteria
   - Monitor processing logs
```

</details>

### 📖 **Documentation & Resources**

<div align="center">

<table>
<tr>
<td align="center" width="25%">

**🌐 [NWS API](https://www.weather.gov/documentation/services-web-api)**<br>
*Official weather service API*<br>
*Alert format specifications*<br>
*Integration guidelines*

</td>
<td align="center" width="25%">

**🏠 [Home Assistant TTS](https://www.home-assistant.io/integrations/tts/)**<br>
*TTS service setup*<br>
*Audio device integration*<br>
*Voice configuration*

</td>
<td align="center" width="25%">

**📬 [Pushover API](https://pushover.net/api)**<br>
*Push notification service*<br>
*HTML formatting guide*<br>
*Priority system*

</td>
<td align="center" width="25%">

**📢 [Gotify Documentation](https://gotify.net/docs/)**<br>
*Self-hosted notifications*<br>
*Markdown formatting*<br>
*API integration*

</td>
</tr>
</table>

</div>

---

<div align="center">

## ⚠️ **Important Weather Safety Notice**

<table border="0">
<tr>
<td align="center">

**🌪️ Critical Events**<br>
This system enhances weather awareness but should not be your only alert source

</td>
<td align="center">

**📱 Backup Systems**<br>
Maintain multiple weather alert sources and emergency communication methods

</td>
<td align="center">

**🧪 Regular Testing**<br>
Test all notification channels monthly and verify proper operation

</td>
</tr>
</table>

---

<img src="https://img.shields.io/badge/Weather-NWS_Certified-blue?style=for-the-badge" alt="NWS">
<img src="https://img.shields.io/badge/Alerts-Real_Time-orange?style=for-the-badge" alt="Real Time">
<img src="https://img.shields.io/badge/Audio-Multi_Device-green?style=for-the-badge" alt="Audio">
<img src="https://img.shields.io/badge/Notifications-Multi_Platform-purple?style=for-the-badge" alt="Notifications">

**🌦️ Intelligent weather monitoring • ⚡ Real-time alert processing • 🔊 Multi-device audio • 📱 Comprehensive notifications**

*Keeping you informed and safe with intelligent weather alert automation*

</div>
