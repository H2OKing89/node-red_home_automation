// ╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗
// ║ ⚠️  DEPRECATED SCRIPT — EFFECTIVE: 2025-08-25                                                        ║
// ║ ---------------------------------------------------------------------------------------------------- ║
// ║ This file is frozen for history only. The live config moved to Node-RED Environment Variables.       ║
// ║                                                                                                      ║
// ║   ▶ Replace this script with ENV VARS (keys & types):                                                ║
// ║        • NOTIFY_MAP_ANDROID    (JSON)                                                                ║
// ║        • NOTIFY_MAP_IOS        (JSON)                                                                ║
// ║        • ALARM_PENDING_TTS     (string)                                                              ║
// ║        • ALARM_TRIGGERED_TTS   (string)                                                              ║
// ║        • ALARM_PENDING_PUSH    (HTML/string)                                                         ║
// ║                                                                                                      ║
// ║   ▶ Quick migrate: Settings → Project/Flows → Environment → add keys → Deploy.                       ║
// ║                                                                                                      ║
// ║   Status: DECOMMISSIONED | Reason: centralized config, safer deploys, cleaner version control.       ║
// ║                                                                                                      ║
// ║   “Old scripts don’t die… they just go read-only.”                                                   ║
// ║                                                                                                      ║
// ╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝

const notifyMapAndroid = {
    "person.alana": "notify.mobile_app_alana_s22u",
    "person.betty": "notify.mobile_app_betty_s24u",
    "person.casey": "notify.mobile_app_casey_s24u",
    "person.joe_hawk": "notify.mobile_app_joe_sa25",
    "person.tom": "notify.mobile_app_tom_s23",
    "person.quentin": [
        "notify.mobile_app_quentin_s25u",
        "notify.mobile_app_quentin_g7u"
    ],
    
};
global.set("notifyMapAndroid", notifyMapAndroid);

const notifyMapIOS = {
    "person.alana": null,
    "person.betty": null,
    "person.casey": null,
    "person.joe_hawk": null,
    "person.tom": null,
    "person.quentin": "notify.mobile_app_quentin_ipad_pro_13",
    // p
};
global.set("notifyMapIOS", notifyMapIOS);

// === TTS Message for Alarm Pending State ===
const alarmPendingTTS = "Heads up! The security system is armed. Please disarm the alarm, I repeat, The security system is armed. Please disarm the alarm,";
global.set("alarmPendingTTS", alarmPendingTTS);

// === TTS Message for Alarm TREIGGERED State ===
const alarmTriggeredTTS = "Heads up! The security system has been triggered. Attention!!, Attention!!, I repeat, The security system has been triggered,";
global.set("alarmTriggeredTTS", alarmTriggeredTTS);

// (Add more stuff here if you want—just use unique global keys!)
const alarmPendingPUSH = '\u200B<b><span style="color: red">Heads up! The security system is armed. Please disarm the alarm</span></b>';
global.set("alarmPendingPUSH", alarmPendingPUSH);
