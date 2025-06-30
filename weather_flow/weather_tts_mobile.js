/**
 * Node-RED Function: Weather Alert TTS to Mobile Device
 * Combines weather alert processing with mobile TTS notification
 * 
 * Version: 1.0.0
 * Author: Quentin
 * Date: June 24, 2025
 */

/* CONFIGURATION - Modify these values as needed */
const config = {
    // Target mobile device notify action (modify this to your device)
    mobileDevice: "notify.mobile_app_quentin_s25u",
    
    // TTS settings
    tts: {
        mediaStream: "alarm_stream_max",
        priority: "high",
        ttl: 0
    },
    
    // Target counties for filtering (modify as needed)
    targetCounties: ['Lancaster, NE', 'Sarpy, NE', 'Saunders, NE', 'Seward, NE'],
    
    // Generic error message
    genericErrorMessage: "An error occurred while processing the weather alert. Please check the system logs."
};

/* HELPER FUNCTIONS */
// Validate alert object
function validateAlert(a) {
    return a && typeof a === 'object' &&
        ['Event', 'Headline', 'Description', 'AreasAffected']
            .every(k => typeof a[k] === 'string' && a[k].trim());
}

// Sanitize raw text
function sanitizeText(t) {
    if (typeof t !== 'string') return '';
    return t.replace(/\*/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim();
}

/* MAIN PROCESSING */
try {
    // Validate input data
    if (!msg.data) {
        node.error('msg.data is undefined');
        return null;
    }

    // Fetch & validate alert
    const rawAlerts = msg.data?.event?.new_state?.attributes?.Alerts;
    if (!Array.isArray(rawAlerts) || !validateAlert(rawAlerts[0])) {
        node.warn('Invalid or missing alert, skipping TTS.');
        return null;
    }

    const raw = rawAlerts[0];

    // Sanitize fields
    const event = sanitizeText(raw.Event);
    const headline = sanitizeText(raw.Headline);
    let desc = sanitizeText(raw.Description);
    const instr = sanitizeText(raw.Instruction);

    // Filter areas to only include specific target counties
    let areas = sanitizeText(raw.AreasAffected);
    if (areas) {
        // Split by semicolons and filter for target counties
        const areaList = areas.split(/[;,]/).map(area => area.trim());
        const filteredAreas = areaList.filter(area =>
            config.targetCounties.some(target => area.includes(target.replace(', NE', '')))
        );
        areas = filteredAreas.join(', ').replace(/\b[A-Z]{2}\b/g, s => ({ NE: 'Nebraska' }[s] || s));
    }

    // Remove Iowa sections from description
    if (desc) {
        desc = desc.replace(/IN IOWA THIS WATCH INCLUDES \d+ COUNTIES[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
            .replace(/IN SOUTHWEST IOWA[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
            .replace(/IN WEST CENTRAL IOWA[\s\S]*?(?=IN NEBRASKA|IN \w+ NEBRASKA|$)/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Filter description to focus on Nebraska content
    if (desc) {
        const neRelevantContent = [];
        const sections = desc.split(/\n{2,}/);

        let inNebraskaPart = false;
        for (const section of sections) {
            // Start capturing when Nebraska is mentioned
            if (/\bNEBRASKA\b/i.test(section)) {
                inNebraskaPart = true;
                neRelevantContent.push(section);
            }
            // Continue capturing while in Nebraska part (and not in other states)
            else if (inNebraskaPart && !/\b(IOWA|KANSAS|MISSOURI|SOUTH DAKOTA)\b/i.test(section)) {
                neRelevantContent.push(section);
            }
            // Stop capturing when another state section begins
            else if (/\b(IOWA|KANSAS|MISSOURI|SOUTH DAKOTA)\b/i.test(section)) {
                inNebraskaPart = false;
            }
        }

        // If we found Nebraska content, use it; otherwise, fall back to general filtering
        if (neRelevantContent.length > 0) {
            desc = neRelevantContent.join("\n\n");
        } else {
            // Fallback: more general filtering of Iowa-related content
            desc = desc.replace(/\b(?:IN|FOR)\s+(?:THE STATE OF\s+)?IOWA\b.*?(?=\b(?:IN|FOR)\s+(?:THE STATE OF\s+)?(?:NEBRASKA|[A-Z]+)\b|$)/gis, '')
                .replace(/\b(?:IOWA|IA)\s+(?:COUNTIES|COUNTY)\b.*?(?=\b(?:NEBRASKA|NE)\s+(?:COUNTIES|COUNTY)\b|$)/gis, '')
                .trim();
        }

        // Clean up extra whitespace
        desc = desc.replace(/\s+/g, ' ').trim();
    }

    // Build TTS message
    const ttsMessage = [
        `The National Weather Service has issued a ${event}.`,
        headline + '.',
        areas ? `The affected areas include ${areas}.` : '',
        desc,
        instr
    ].filter(Boolean).join(' ');

    // Validate we have a device configured
    if (!config.mobileDevice) {
        node.error('No mobile device configured in config.mobileDevice');
        return null;
    }

    // Build mobile TTS payload
    const outMsg = {
        payload: {
            action: config.mobileDevice,
            data: {
                message: "TTS",
                // This 'data' key is used for TTS parameters. Home Assistant expects it this way.
                data: {
                    ttl: config.tts.ttl,
                    priority: config.tts.priority,
                    media_stream: config.tts.mediaStream,
                    tts_text: ttsMessage
                }
            }
        }
    };

    node.log(`Sending weather alert TTS to ${config.mobileDevice}`);
    return [outMsg];

} catch (e) {
    node.error('Processing error: ' + e.message);
    
    // Send error message as TTS if device is configured
    if (config.mobileDevice) {
        const errorMsg = {
            payload: {
                action: config.mobileDevice,
                data: {
                    message: "TTS",
                    data: {
                        ttl: config.tts.ttl,
                        priority: config.tts.priority,
                        media_stream: config.tts.mediaStream,
                        tts_text: config.genericErrorMessage
                    }
                }
            }
        };
        return [errorMsg];
    }
    
    return null;
}
