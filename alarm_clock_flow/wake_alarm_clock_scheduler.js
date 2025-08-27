// ========================================
// ⏰ WAKE ALARM CLOCK TTS SCHEDULER + LIGHT CONTROL
// ========================================
// Processes cron job messages and creates TTS announcements for Sonos amp with synchronized light control
// Input: Cron job message with time trigger information
// Output 1: Formatted TTS message for Home Assistant Sonos integration
// Output 2: Light control message for Home Assistant lighting automation

// ========================================
// 🔍 PROFESSIONAL LOGGING SYSTEM
// ========================================

function createLogger() {
    return {
        debug: (message, data) => {
            node.debug(`[Wake Alarm] ${message}`);
            if (data) node.debug(JSON.stringify(data, null, 2));
        },
        info: (message, data) => {
            node.log(`[Wake Alarm] ${message}`);
            if (data) node.debug(JSON.stringify(data, null, 2));
        },
        warn: (message, data) => {
            node.warn(`[Wake Alarm] ${message}`);
            if (data) node.warn(JSON.stringify(data, null, 2));
        },
        error: (message, error, msg) => {
            node.error(`[Wake Alarm] ${message}: ${error?.message || error}`, msg);
            if (error?.stack) node.debug(`Stack trace: ${error.stack}`);
        }
    };
}

const logger = createLogger();

// --- Date-fns-tz Integration ---
let formatInTimeZone;
try {
    if (dateFnsTz && dateFnsTz.formatInTimeZone) {
        formatInTimeZone = dateFnsTz.formatInTimeZone;
        logger.info('date-fns-tz module loaded successfully');
    } else {
        logger.error('date-fns-tz not available - alarm announcements may use server time');
        formatInTimeZone = undefined;
    }
} catch (error) {
    logger.error('Error loading date-fns-tz module - using fallback time formatting', error);
    formatInTimeZone = undefined;
}

// --- Environment Configuration ---
const alarmConfigRaw = env.get("ALARM_CLOCK") || {};
const alarmConfig = alarmConfigRaw.alarm_clock || alarmConfigRaw; // Support both nested and direct structure
const TIME_ZONE = alarmConfig.timezone || 'America/Chicago'; // 🌍 Fallback to default
const SONOS_ENTITY_ID = alarmConfig.sonos?.entity_id || 'media_player.bedroom_sonos_amp';
const DEFAULT_VOLUME = alarmConfig.sonos?.volume || 85;
const LIGHT_ENTITY_ID = alarmConfig.light?.entity_id || 'light.basement_bedroom_light';
const LIGHT_BRIGHTNESS = alarmConfig.light?.brightness_pct || 100;
const LIGHT_TRANSITION = alarmConfig.light?.transition || 300;

// --- Configuration Validation ---
if (!alarmConfig.sonos?.entity_id) {
    logger.warn('Using default Sonos entity ID - consider setting alarm_clock.sonos.entity_id in environment');
    node.status({
        fill: 'yellow',
        shape: 'dot',
        text: 'Using default Sonos config'
    });
} else {
    logger.info(`Loaded Sonos entity: ${SONOS_ENTITY_ID}, Volume: ${DEFAULT_VOLUME}, Timezone: ${TIME_ZONE}`);
}

if (!alarmConfig.light?.entity_id) {
    logger.warn('Using default Light entity ID - consider setting alarm_clock.light.entity_id in environment');
    node.status({
        fill: 'yellow',
        shape: 'dot', 
        text: 'Using default Light config'
    });
} else {
    logger.info(`Loaded Light entity: ${LIGHT_ENTITY_ID}, Brightness: ${LIGHT_BRIGHTNESS}%, Transition: ${LIGHT_TRANSITION}s`);
}

// Clear initialization status - ready for processing
node.status({
    fill: 'grey',
    shape: 'ring',
    text: 'Ready for alarm messages'
});

// ========================================
//  ENVIRONMENT CONFIGURATION DEBUG
// ========================================

// Debug environment configuration
logger.debug('Environment configuration loaded', {
    alarm_config_structure: Object.keys(alarmConfig),
    sonos_configured: !!alarmConfig.sonos?.entity_id,
    light_configured: !!alarmConfig.light?.entity_id,
    timezone: TIME_ZONE,
    dateFns_available: !!formatInTimeZone
});

// --- Validate Incoming Message ---
if (!msg.payload?.triggerTimestamp || !msg.topic) {
    logger.warn('Invalid alarm message format - missing triggerTimestamp or topic', {
        payload: msg.payload,
        topic: msg.topic
    });
    node.status({
        fill: 'yellow',
        shape: 'ring',
        text: 'Invalid message format'
    });
    return null;
}

// ========================================
// 🧹 CLEANUP AND LIFECYCLE MANAGEMENT
// ========================================

// Add cleanup event handler for proper resource management
node.on('close', function() {
    logger.info('Wake alarm scheduler node is shutting down');
    
    // Clear any active timers (future enhancement placeholder)
    const activeTimers = context.get("active_timers") || {};
    Object.values(activeTimers).forEach(timerId => {
        if (timerId) {
            clearTimeout(timerId);
        }
    });
    
    if (Object.keys(activeTimers).length > 0) {
        logger.info(`Cleaned up ${Object.keys(activeTimers).length} active timers`);
        context.set("active_timers", {});
    }
    
    // Clear node status
    node.status({});
});

// ========================================
// 🎯 EXTRACT TIME INFORMATION
// ========================================

function processAlarmTime(message) {
    try {
        // Extract time from cron message
        const triggerTimestamp = message.payload.triggerTimestamp;
        const scheduledTime = message.topic; // "12:00" format
        const cronDescription = message.payload.status?.description || 'Alarm';
        
        // Create Date object from timestamp
        const alarmTime = new Date(triggerTimestamp);
        
        // Format time for different uses
        let formattedTimes;
        if (formatInTimeZone) {
            // Professional time formatting with timezone awareness
            formattedTimes = {
                // For TTS announcements - natural speech
                tts: formatInTimeZone(alarmTime, TIME_ZONE, "h:mm a"),
                // For display/logging - full format
                display: formatInTimeZone(alarmTime, TIME_ZONE, "MMMM do, yyyy 'at' h:mm a zzz"),
                // For debugging - ISO format
                iso: formatInTimeZone(alarmTime, TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss XXX")
            };
        } else {
            // Fallback formatting using native Date methods
            /** @type {Intl.DateTimeFormatOptions} */
            const timeOptions = {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: TIME_ZONE
            };

            /** @type {Intl.DateTimeFormatOptions} */
            const displayOptions = {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: TIME_ZONE,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZoneName: 'short'
            };

            formattedTimes = {
                tts: alarmTime.toLocaleTimeString('en-US', timeOptions),
                display: alarmTime.toLocaleString('en-US', displayOptions),
                iso: alarmTime.toISOString()
            };
        }
        
        return {
            success: true,
            originalTime: scheduledTime,
            alarmTime: alarmTime,
            formattedTimes: formattedTimes,
            description: cronDescription,
            count: message.payload.status?.count || 1
        };
        
    } catch (error) {
        logger.error('Error processing alarm time', error, msg);
        node.status({
            fill: 'red',
            shape: 'ring',
            text: `Processing error: ${error.message}`
        });
        return {
            success: false,
            error: error.message,
            fallbackTime: msg.topic || 'Unknown time'
        };
    }
}

// ========================================
// 🗣️ CREATE TTS MESSAGES
// ========================================

function createTTSMessages(timeData) {
    if (!timeData.success) {
        // Fallback TTS for errors
        return {
            primary: `Good morning! Your alarm is going off at ${timeData.fallbackTime}.`,
            backup: "Good morning! Your alarm is going off."
        };
    }
    
    const time = timeData.formattedTimes.tts;
    const count = timeData.count;
    
    // Create multiple TTS variations for different alarm triggers
    const ttsVariations = [
        `Good morning! The time is ${time}. This is your scheduled wake up alarm.`,
        `Wake up! It's ${time}. Your alarm is now active.`,
        `Good morning! Your ${time} alarm is going off. Time to start your day.`,
        `It's ${time}. This is your wake up call. Good morning!`,
        `Good morning! The current time is ${time}. Your alarm has been triggered.`
    ];
    
    // Select variation based on alarm count (cycles through variations)
    const selectedIndex = (count - 1) % ttsVariations.length;
    const primaryMessage = ttsVariations[selectedIndex];
    
    // Create backup message
    const backupMessage = `Good morning! It's ${time}. Wake up!`;
    
    return {
        primary: primaryMessage,
        backup: backupMessage,
        time: time,
        variation: selectedIndex + 1
    };
}

// ========================================
// 🔊 SONOS TTS PAYLOAD CREATION
// ========================================

function createSonosTTSPayload(ttsMessage, volume = null) {
    // Use environment volume or provided volume or default fallback
    const finalVolume = volume !== null ? volume : DEFAULT_VOLUME;
    
    // URL encode the message for Sonos media_content_id
    // Note: Some Sonos integrations may require quotes, adjust based on your setup
    const encodedMessage = encodeURIComponent(ttsMessage);
    
    return {
        action: "media_player.play_media",
        target: { 
            entity_id: [SONOS_ENTITY_ID] // 🔊 From environment configuration
        },
        data: {
            media_content_id: `media-source://tts/google_translate?message=${encodedMessage}`,
            media_content_type: "music",
            announce: true,
            extra: { 
                volume: finalVolume 
            }
        }
    };
}

// ========================================
// 💡 LIGHT CONTROL PAYLOAD CREATION
// ========================================

function createLightTurnOnPayload(brightness = null, transition = null) {
    // Use environment settings or provided values or defaults
    const finalBrightness = brightness !== null ? brightness : LIGHT_BRIGHTNESS;
    const finalTransition = transition !== null ? transition : LIGHT_TRANSITION;
    
    return {
        action: "light.turn_on",
        target: {
            entity_id: [LIGHT_ENTITY_ID] // 💡 From environment configuration
        },
        data: {
            brightness_pct: finalBrightness,
            transition: finalTransition
        }
    };
}

// ========================================
// 🎯 MAIN PROCESSING LOGIC
// ========================================

// Set initial processing status
node.status({
    fill: 'blue',
    shape: 'dot',
    text: 'Processing alarm...'
});

// Process the alarm time
const timeData = processAlarmTime(msg);

// Create TTS messages
const ttsMessages = createTTSMessages(timeData);

// Log alarm details
if (timeData.success) {
    logger.info(`Alarm triggered: ${timeData.formattedTimes.display}`);
    logger.info(`TTS Message: "${ttsMessages.primary}"`);
    
    node.status({
        fill: 'green',
        shape: 'dot',
        text: `Alarm: ${timeData.formattedTimes.tts} (Count: ${timeData.count})`
    });
} else {
    logger.error(`Alarm processing failed: ${timeData.error}`, null, msg);
    node.status({
        fill: 'red',
        shape: 'ring',
        text: `Error: ${timeData.error}`
    });
}

// ========================================
// 📤 CREATE OUTPUT MESSAGES
// ========================================

// Critical validation before creating payloads
if (!SONOS_ENTITY_ID || !LIGHT_ENTITY_ID) {
    const criticalError = 'Critical configuration missing: Sonos or Light entity ID not configured';
    logger.error(criticalError, new Error(criticalError), msg);
    node.status({
        fill: 'red',
        shape: 'ring',
        text: 'Critical config error'
    });
    // Trigger catch node for critical errors
    node.error(criticalError, msg);
    return null;
}

// Create the Home Assistant payload for Sonos TTS (uses environment volume)
const sonosPayload = createSonosTTSPayload(ttsMessages.primary);

// Create the Home Assistant payload for Light control (uses environment settings)  
const lightPayload = createLightTurnOnPayload();

// Debug payload creation
logger.debug('Payloads created successfully', {
    sonos_entity: sonosPayload.target.entity_id[0],
    sonos_volume: sonosPayload.data.extra.volume,
    light_entity: lightPayload.target.entity_id[0],
    light_brightness: lightPayload.data.brightness_pct,
    light_transition: lightPayload.data.transition
});

// Prepare comprehensive TTS output message (Output 1)
const ttsOutputMessage = {
    payload: sonosPayload,
    
    // Original alarm data for debugging/logging
    alarm_data: {
        original_topic: msg.topic,
        trigger_timestamp: msg.payload?.triggerTimestamp,
        cron_description: msg.payload?.status?.description,
        alarm_count: timeData.success ? timeData.count : 0,
        scheduled_time: timeData.success ? timeData.originalTime : 'unknown'
    },
    
    // TTS message details
    tts_data: {
        primary_message: ttsMessages.primary,
        backup_message: ttsMessages.backup,
        formatted_time: timeData.success ? timeData.formattedTimes.tts : 'unknown',
        message_variation: ttsMessages.variation || 1
    },
    
    // Timezone and formatting info
    time_data: timeData.success ? {
        formatted_display: timeData.formattedTimes.display,
        formatted_iso: timeData.formattedTimes.iso,
        timezone: TIME_ZONE,
        date_fns_available: !!formatInTimeZone
    } : null,
    
    // Message metadata
    automation_source: "wake_alarm_clock_scheduler",
    generated_at: new Date().toISOString(),
    _msgid: msg._msgid // Preserve original message ID
};

// Prepare dedicated Light control output message (Output 2)
const lightOutputMessage = {
    payload: lightPayload,
    
    // Light control metadata
    light_data: {
        entity_id: LIGHT_ENTITY_ID,
        brightness_pct: LIGHT_BRIGHTNESS,
        transition: LIGHT_TRANSITION,
        triggered_by: "wake_alarm_clock_scheduler"
    },
    
    // Reference to alarm that triggered this light action
    alarm_reference: {
        scheduled_time: timeData.success ? timeData.originalTime : 'unknown',
        trigger_timestamp: msg.payload?.triggerTimestamp,
        alarm_count: timeData.success ? timeData.count : 0
    },
    
    // Message metadata
    automation_source: "wake_alarm_clock_scheduler",
    generated_at: new Date().toISOString(),
    _msgid: msg._msgid // Preserve original message ID
};

// ========================================
// 🎯 ADVANCED FEATURES (OPTIONAL)
// ========================================

// Store alarm history in context for tracking
const alarmHistory = context.get('alarm_history') || [];
alarmHistory.push({
    timestamp: new Date().toISOString(),
    scheduled_time: msg.topic,
    trigger_timestamp: msg.payload?.triggerTimestamp,
    tts_message: ttsMessages.primary,
    success: timeData.success
});

// Keep only last 10 alarms
if (alarmHistory.length > 10) {
    alarmHistory.shift();
}
context.set('alarm_history', alarmHistory);

// Update alarm counter
const alarmCounter = context.get('alarm_counter') || 0;
context.set('alarm_counter', alarmCounter + 1);

// Log summary for debugging
logger.info(`Alarm Summary: Count=${timeData.count}, Total=${alarmCounter + 1}, History=${alarmHistory.length} entries`);
logger.info(`Light Control: ${LIGHT_ENTITY_ID} → ${LIGHT_BRIGHTNESS}% brightness, ${LIGHT_TRANSITION}s transition`);

// ========================================
// 📋 FINAL OUTPUT
// ========================================

// Update status to show successful completion
node.status({
    fill: 'green',
    shape: 'dot',
    text: `Complete: TTS + Light (${timeData.success ? timeData.formattedTimes.tts : 'Error'})`
});

// Return separate messages: [TTS Message, Light Control Message]
return [ttsOutputMessage, lightOutputMessage];

// ========================================
// 📝 USAGE NOTES
// ========================================
/*
This function processes cron job messages and creates TTS announcements for Sonos speakers
with synchronized light control for a complete wake-up experience.

INPUT FORMAT (from cron job):
{
  "topic": "12:00",
  "payload": {
    "triggerTimestamp": 1756227660000,
    "status": {
      "count": 1,
      "description": "At 12:01"
    }
  }
}

OUTPUT FORMAT (to Home Assistant):
This function returns an ARRAY of two messages for dual output processing:

RETURN VALUE: [ttsOutputMessage, lightOutputMessage]

TTS Output (Output 1 - Array Index 0):
{
  "payload": {
    "action": "media_player.play_media",
    "target": { "entity_id": ["media_player.bedroom_sonos_amp"] },
    "data": {
      "media_content_id": "media-source://tts/google_translate?message=...",
      "media_content_type": "music",
      "announce": true,
      "extra": { "volume": 85 }
    }
  },
  "alarm_data": { ... },
  "tts_data": { ... },
  "time_data": { ... }
}

Light Control Output (Output 2 - Array Index 1):
{
  "payload": {
    "action": "light.turn_on",
    "target": { "entity_id": ["light.basement_bedroom_light"] },
    "data": {
      "brightness_pct": 100,
      "transition": 300
    }
  },
  "light_data": { ... },
  "alarm_reference": { ... }
}

DUAL OUTPUT USAGE:
- Connect Output 1 to Home Assistant API Call node for TTS
- Connect Output 2 to Home Assistant API Call node for Light Control
- Both outputs fire simultaneously for synchronized wake-up experience

REQUIRED MODULES:
- date-fns-tz (for timezone-aware formatting) - Optional but recommended

ENVIRONMENT CONFIGURATION (.env file):
{
  "alarm_clock": {
    "sonos": {
      "entity_id": "media_player.bedroom_sonos_amp",
      "volume": 85
    },
    "light": {
      "entity_id": "light.basement_bedroom_light",
      "brightness_pct": 100,
      "transition": 300
    },
    "timezone": "America/Chicago",
    "tts_variations": 5
  }
}

CONFIGURATION:
1. Set alarm_clock.sonos.entity_id in .env file
2. Set alarm_clock.sonos.volume in .env file  
3. Set alarm_clock.light.entity_id in .env file
4. Set alarm_clock.light.brightness_pct and transition in .env file
5. Adjust alarm_clock.timezone if needed
6. Modify TTS messages in createTTSMessages() function
7. Install date-fns-tz module for enhanced timezone support (optional)
8. Configure Function Node with 2 outputs in Node-RED editor
9. Connect Output 1 to Home Assistant API Call node (TTS)
10. Connect Output 2 to Home Assistant API Call node (Light Control)

NODE-RED FUNCTION SETUP:
- Set "Number of outputs" to 2 in Function node properties
- Output 1: Routes to Home Assistant TTS service
- Output 2: Routes to Home Assistant Light service
- Both outputs process simultaneously for coordinated wake-up

FEATURES:
- Multiple TTS message variations
- Synchronized light control with configurable brightness and transition
- Dual output system (TTS + Light control)
- Timezone-aware time formatting (with date-fns-tz) or fallback formatting
- Robust error handling with graceful fallbacks
- Alarm history tracking
- Professional logging
- Comprehensive debugging data
- Module availability detection and fallback behavior
- Environment-driven configuration for both audio and lighting
- Independent Home Assistant action payloads for seamless integration
*/
