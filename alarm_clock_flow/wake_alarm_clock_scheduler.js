// ========================================
// ⏰ WAKE ALARM CLOCK TTS SCHEDULER
// ========================================
// Processes cron job messages and creates TTS announcements for Sonos amp
// Input: Cron job message with time trigger information
// Output: Formatted TTS message for Home Assistant Sonos integration

// --- Date-fns-tz Integration ---
const { formatInTimeZone } = dateFnsTz;
const TIME_ZONE = 'America/Chicago'; // 🌍 Matches your cron timezone

// --- Error Handling Check ---
if (!dateFnsTz?.formatInTimeZone) {
    node.error('❌ date-fns-tz not available - alarm announcements may use server time');
    // Continue with fallback behavior
}

// --- Validate Incoming Message ---
if (!msg.payload?.triggerTimestamp || !msg.topic) {
    node.warn('⚠️ Invalid alarm message format - missing triggerTimestamp or topic');
    node.status({
        fill: 'yellow',
        shape: 'ring',
        text: 'Invalid message format'
    });
    return null;
}

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
            const timeOptions = { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true,
                timeZone: TIME_ZONE
            };
            formattedTimes = {
                tts: alarmTime.toLocaleTimeString('en-US', timeOptions),
                display: alarmTime.toLocaleString('en-US', {
                    ...timeOptions,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZoneName: 'short'
                }),
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
        node.error(`❌ Error processing alarm time: ${error.message}`);
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

function createSonosTTSPayload(ttsMessage, volume = 80) {
    // URL encode the message for Sonos media_content_id
    const encodedMessage = encodeURIComponent(`"${ttsMessage}"`);
    
    return {
        action: "media_player.play_media",
        target: { 
            entity_id: ["media_player.bedroom_sonos_amp"] // 🔊 Update with your Sonos entity ID
        },
        data: {
            media_content_id: `media-source://tts/google_translate?message=${encodedMessage}`,
            media_content_type: "music",
            announce: true,
            extra: { 
                volume: volume 
            }
        }
    };
}

// ========================================
// 🎯 MAIN PROCESSING LOGIC
// ========================================

// Process the alarm time
const timeData = processAlarmTime(msg);

// Create TTS messages
const ttsMessages = createTTSMessages(timeData);

// Log alarm details
if (timeData.success) {
    node.log(`⏰ Alarm triggered: ${timeData.formattedTimes.display}`);
    node.log(`🗣️ TTS Message: "${ttsMessages.primary}"`);
    
    node.status({
        fill: 'green',
        shape: 'dot',
        text: `Alarm: ${timeData.formattedTimes.tts} (Count: ${timeData.count})`
    });
} else {
    node.warn(`⚠️ Alarm processing failed: ${timeData.error}`);
    node.status({
        fill: 'red',
        shape: 'ring',
        text: `Error: ${timeData.error}`
    });
}

// ========================================
// 📤 CREATE OUTPUT MESSAGE
// ========================================

// Create the Home Assistant payload for Sonos TTS
const sonosPayload = createSonosTTSPayload(ttsMessages.primary, 85); // 85% volume

// Prepare comprehensive output message
const outputMessage = {
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
node.log(`📊 Alarm Summary: Count=${timeData.count}, Total=${alarmCounter + 1}, History=${alarmHistory.length} entries`);

// ========================================
// 📋 FINAL OUTPUT
// ========================================

// Return the formatted message for Home Assistant
return outputMessage;

// ========================================
// 📝 USAGE NOTES
// ========================================
/*
This function processes cron job messages and creates TTS announcements for Sonos speakers.

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
  }
}

REQUIRED MODULES:
- date-fns-tz (for timezone-aware formatting)

CONFIGURATION:
1. Update Sonos entity ID in createSonosTTSPayload()
2. Adjust TIME_ZONE if needed
3. Modify TTS messages in createTTSMessages()
4. Adjust volume levels as needed

FEATURES:
- Multiple TTS message variations
- Timezone-aware time formatting
- Error handling with fallbacks
- Alarm history tracking
- Professional logging
- Comprehensive debugging data
*/
