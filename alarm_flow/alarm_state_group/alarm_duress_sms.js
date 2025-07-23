/****************************************************
 * Script Name: Duress Alarm SMS Message Sender
 * Author: Quentin King
 * Version: 1.0.0
 ****************************************************/

const LOGGING_ENABLED = true;
const SCRIPT_VERSION = '1.0.0';
const executionId = `${Date.now()}-${Math.random().toString(36).slice(2,11)}`;

// Import date-fns-tz for robust time zone and DST handling
const TIME_ZONE = 'America/Chicago';

// Standard format strings per documentation
const FORMATS = {
    push: "MMMM do, yyyy h:mm a zzz",
    tts: "MMMM do, yyyy 'at' h:mm a zzz",
    iso: "yyyy-MM-dd HH:mm:ss"
};

// Error handling for missing libraries per documentation standards
if (!dateFnsTz?.formatInTimeZone) {
    node.error('[alarm_duress_sms] date-fns-tz not available in global context');
    return null;
}
const { formatInTimeZone } = dateFnsTz;

// Standard function per documentation
function getFormattedTimes(date = new Date()) {
    if (!dateFnsTz?.formatInTimeZone) {
        node.warn('[alarm_duress_sms] date-fns-tz not available. Using fallback.');
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
    
    try {
        return {
            formattedTimePush: formatInTimeZone(date, TIME_ZONE, FORMATS.push),
            formattedTimeTTS: formatInTimeZone(date, TIME_ZONE, FORMATS.tts)
        };
    } catch (error) {
        node.error(`[alarm_duress_sms] Error formatting date: ${error.message}`);
        const fallback = date.toISOString();
        return { formattedTimePush: fallback, formattedTimeTTS: fallback };
    }
}

// Simple logging: enable/disable only
function log(message, level = "info") {
    if (!LOGGING_ENABLED) return;
    if (level === "error") node.error(message);
    else if (level === "warn") node.warn(message);
    else node.log(message);
}

// Initial debug log when the script starts
log(`[Debug] Script start: executionId=${executionId}`);

// Ensure msg object exists for Node-RED context
msg = msg || {};

/**
 * Get SMS recipients from environment variable
 * @returns {Array} Array of phone numbers
 */
function getSmsRecipients() {
    try {
        let smsNumbersRaw = env.get("DURESS_SMS_NUMBERS");
        if (typeof smsNumbersRaw === 'object' && smsNumbersRaw !== null) {
            if (smsNumbersRaw.sms_numbers) {
                return Object.values(smsNumbersRaw.sms_numbers);
            }
        } else if (typeof smsNumbersRaw === 'string') {
            const smsObj = JSON.parse(smsNumbersRaw);
            if (smsObj.sms_numbers) {
                return Object.values(smsObj.sms_numbers);
            }
        }
        log('No SMS numbers found in DURESS_SMS_NUMBERS', 'warn');
        return [];
    } catch (error) {
        log(`[ERROR] Failed to parse DURESS_SMS_NUMBERS: ${error.message}`, 'error');
        return [];
    }
}

/**
 * Build TextBee API request payload
 * @param {Array} recipients - Array of phone numbers
 * @param {string} message - SMS message content
 * @returns {Object} API request payload
 */
function buildSmsPayload(recipients, message) {
    return {
        recipients: recipients,
        message: message
    };
}

/**
 * Build HTTP request options for TextBee API
 * @param {string} deviceId - Device ID from environment
 * @param {string} apiKey - API key from environment
 * @param {Object} payload - SMS payload
 * @returns {Object} HTTP request options
 */
function buildHttpRequest(deviceId, apiKey, payload) {
    const baseUrl = 'https://api.textbee.dev/api/v1';
    const url = `${baseUrl}/gateway/devices/${deviceId}/send-sms`;
    
    return {
        url: url,
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload)
    };
}

// Main async IIFE to process incoming message and send SMS
return (async () => {
    const now = new Date();
    const { formattedTimePush, formattedTimeTTS } = getFormattedTimes(now);
    
    try {
        log('[Debug] Async function start');
        const ts = formattedTimePush;
        log(`[Debug] Timestamp=${ts}`);

        // Validate incoming message
        if (!msg.payload || !msg.payload.message) {
            log('[ERROR] No message content found in msg.payload.message', 'error');
            return [{
                payload: {
                    error: 'No message content provided',
                    execution_id: executionId,
                    generated_at: now.toISOString(),
                    alert_type: 'SMS_ERROR',
                    priority: 'HIGH'
                }
            }, null];
        }

        // Get environment variables
        const apiKey = env.get("SMS_API");
        const deviceId = env.get("DEVICE_ID");
        
        if (!apiKey) {
            log('[ERROR] SMS_API environment variable not set', 'error');
            return [{
                payload: {
                    error: 'SMS API key not configured',
                    execution_id: executionId,
                    generated_at: now.toISOString(),
                    alert_type: 'SMS_CONFIG_ERROR',
                    priority: 'HIGH'
                }
            }, null];
        }

        if (!deviceId) {
            log('[ERROR] DEVICE_ID environment variable not set', 'error');
            return [{
                payload: {
                    error: 'SMS Device ID not configured',
                    execution_id: executionId,
                    generated_at: now.toISOString(),
                    alert_type: 'SMS_CONFIG_ERROR',
                    priority: 'HIGH'
                }
            }, null];
        }

        // Get SMS recipients
        const recipients = getSmsRecipients();
        if (recipients.length === 0) {
            log('[ERROR] No SMS recipients found', 'error');
            return [{
                payload: {
                    error: 'No SMS recipients configured',
                    execution_id: executionId,
                    generated_at: now.toISOString(),
                    alert_type: 'SMS_CONFIG_ERROR',
                    priority: 'HIGH'
                }
            }, null];
        }

        log(`[Debug] Found ${recipients.length} SMS recipients`);
        log(`[Debug] Recipients: ${recipients.join(', ')}`);

        // Extract message from incoming payload
        const smsMessage = msg.payload.message;
        log(`[Debug] SMS Message: ${smsMessage.substring(0, 100)}...`);

        // Build API request
        const smsPayload = buildSmsPayload(recipients, smsMessage);
        const httpRequest = buildHttpRequest(deviceId, apiKey, smsPayload);
        
        log('[Debug] HTTP request built successfully');
        log(`[Debug] API URL: ${httpRequest.url}`);

        // Prepare output messages
        const successPayload = {
            message: 'SMS request prepared successfully',
            title: 'SMS Alert Sent',
            topic: 'SMS Alert Sent',
            footer_text: `SMS Alert System - ${ts}`,
            version: SCRIPT_VERSION,
            generated_at: now.toISOString(),
            execution_id: executionId,
            alert_type: 'SMS_SUCCESS',
            priority: 'INFO',
            recipients_count: recipients.length,
            original_message: msg.payload
        };

        // HTTP request message for output 2 (to HTTP Request node)
        const httpRequestMsg = {
            payload: httpRequest.payload,
            url: httpRequest.url,
            method: httpRequest.method,
            headers: httpRequest.headers,
            timeout: 30000
        };

        log('[Debug] SMS request prepared successfully');
        log('[Debug] Async success, returning messages');
        
        // Output 1: Success status, Output 2: HTTP request for TextBee API
        node.done();
        return [{ payload: successPayload }, httpRequestMsg];
        
    } catch (error) {
        log(`[ERROR] Failed to process SMS request: ${error.message}`, 'error');
        // Return error payload
        return [{
            payload: {
                message: 'EMERGENCY: System Error - Unable to send SMS alert',
                title: 'SMS SYSTEM ERROR',
                topic: 'SMS SYSTEM ERROR',
                error: error.message,
                execution_id: executionId,
                generated_at: now.toISOString(),
                alert_type: 'SMS_ERROR',
                priority: 'HIGH'
            }
        }, null];
    }
})();
