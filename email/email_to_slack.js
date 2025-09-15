// Voicemail to Slack Transfer Script for Node-RED
// This script processes FreePBX voicemail notifications and formats them for Slack

// Initialize configuration from environment variables with context caching
function initializeConfig() {
    // Check if config is already cached
    let config = context.get("voicemail_config");
    
    if (!config) {
        try {
            config = {
                slackChannel: env.get("SLACK_CHANNEL_VOICEMAIL") || "general",
                slackMember: env.get("SLACK_MEMBER_BETTY") || null,
                authorizedEmail: env.get("AUTHORIZED_EMAIL") || null,
                initialized: new Date().toISOString()
            };
            
            // Cache configuration in context
            context.set("voicemail_config", config);
            
            node.log(`Configuration initialized - Channel: ${config.slackChannel}, Member: ${config.slackMember ? 'Set' : 'Not set'}, Email: ${config.authorizedEmail ? 'Set' : 'Not set'}`);
        } catch (error) {
            node.error(`Error loading environment variables: ${error.message}`, msg);
            
            // Fallback configuration
            config = {
                slackChannel: "general",
                slackMember: null,
                authorizedEmail: null,
                initialized: new Date().toISOString(),
                error: error.message
            };
            context.set("voicemail_config", config);
        }
    }
    
    return config;
}

// Initialize configuration
const config = initializeConfig();

// Function to extract sender email from message headers
function extractSenderEmail(msg) {
    try {
        // Try different possible locations for the sender email
        if (msg.header && msg.header.from) {
            if (msg.header.from.value && msg.header.from.value[0] && msg.header.from.value[0].address) {
                return msg.header.from.value[0].address;
            }
            if (msg.header.from.text) {
                // Extract email from "Name <email@domain.com>" format
                const emailMatch = msg.header.from.text.match(/<([^>]+)>/);
                if (emailMatch) {
                    return emailMatch[1];
                }
                return msg.header.from.text;
            }
        }

        // Fallback to msg.from if header is not available
        if (msg.from) {
            return msg.from;
        }

        node.debug("No sender email found in message");
        return null;
    } catch (error) {
        node.warn(`Error extracting sender email: ${error.message}`);
        return null;
    }
}

// Function to parse voicemail payload
function parseVoicemailPayload(payload) {
    node.debug("Parsing voicemail payload");
    
    const lines = payload.split('\n');
    let voicemailInfo = {
        mailbox: '',
        from: '',
        length: '',
        date: '',
        message: ''
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.includes('mailbox')) {
            const match = line.match(/mailbox (\d+):/);
            if (match) voicemailInfo.mailbox = match[1];
        }

        if (line.startsWith('From:')) {
            voicemailInfo.from = line.replace('From:', '').trim();
        }

        if (line.startsWith('Length:')) {
            voicemailInfo.length = line.replace('Length:', '').trim();
        }

        if (line.startsWith('Date:')) {
            voicemailInfo.date = line.replace('Date:', '').trim();
        }
    }

    node.debug(`Parsed voicemail info:`, voicemailInfo);
    return voicemailInfo;
}

// Function to format Slack message
function formatSlackMessage(voicemailInfo, originalMsg) {
    const mention = (config.slackMember && typeof config.slackMember === 'string' && config.slackMember.trim() !== '')
        ? `<@${config.slackMember.trim()}>`
        : "";
        
    const callerName = voicemailInfo.from || 'Unknown Caller';
    const duration = voicemailInfo.length || 'Unknown duration';
    const voicemailDate = voicemailInfo.date || new Date().toLocaleString();

    // Create a formatted Slack message
    let message = {
        channel: config.slackChannel,
        // Keep mention in text for push notifications
        text: `📞 New Voicemail Received!${mention ? ` ${mention}` : ""}`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "📞 New Voicemail"
                }
            }
        ]
    };

    // Add visible mention in-channel if specified
    if (mention) {
        message.blocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `${mention} — you've got a new voicemail.`
            }
        });
        node.debug(`Tagging Slack member: ${config.slackMember}`);
    } else {
        node.warn(`SLACK_MEMBER_BETTY not set or empty. Current value: ${config.slackMember}`);
    }

    // Add voicemail information fields
    message.blocks.push({
        type: "section",
        fields: [
            {
                type: "mrkdwn",
                text: `*From:* ${callerName}`
            },
            {
                type: "mrkdwn",
                text: `*Duration:* ${duration}`
            },
            {
                type: "mrkdwn",
                text: `*Date:* ${voicemailDate}`
            },
            {
                type: "mrkdwn",
                text: `*Mailbox:* ${voicemailInfo.mailbox || '6000'}`
            }
        ]
    });

    return message;
}

// Main processing function
function processVoicemail(msg) {
    // Update node status to show processing
    node.status({
        fill: "blue",
        shape: "dot",
        text: "Processing voicemail..."
    });
    
    try {
        // Input validation
        if (!msg || typeof msg !== 'object') {
            throw new Error("Invalid message object");
        }
        
        if (!msg.payload || typeof msg.payload !== 'string') {
            throw new Error("Message payload is missing or not a string");
        }

        // Validate required environment variables
        if (!config.slackChannel) {
            throw new Error("SLACK_CHANNEL_VOICEMAIL environment variable is not set");
        }

        // Check if email is from authorized sender
        if (config.authorizedEmail && typeof config.authorizedEmail === 'string') {
            const senderEmail = extractSenderEmail(msg);
            if (!senderEmail || senderEmail.toLowerCase() !== config.authorizedEmail.toLowerCase()) {
                node.warn(`Unauthorized email sender: ${senderEmail}. Expected: ${config.authorizedEmail}`);
                
                // Update node status
                node.status({
                    fill: "yellow",
                    shape: "ring",
                    text: "Unauthorized sender"
                });
                
                return null; // Don't process unauthorized emails
            }
        }

        // Parse the voicemail payload
        const voicemailInfo = parseVoicemailPayload(msg.payload);
        
        // Track processing statistics
        let stats = context.get("processing_stats") || { 
            processed: 0, 
            errors: 0, 
            last_processed: null 
        };
        stats.processed++;
        stats.last_processed = new Date().toISOString();
        context.set("processing_stats", stats);

        // Format for Slack
        const slackMessage = formatSlackMessage(voicemailInfo, msg);

        // Update node status to show success
        node.status({
            fill: "green",
            shape: "dot",
            text: `Processed (#${stats.processed})`
        });

        node.log(`Voicemail processed successfully from ${voicemailInfo.from || 'unknown caller'}`);

        // Return the formatted message for Slack node
        return {
            topic: "chat.postMessage",
            payload: slackMessage,
            originalVoicemail: msg.payload,
            voicemailInfo: voicemailInfo,
            processed_at: new Date().toISOString(),
            stats: stats
        };

    } catch (error) {
        // Track error statistics
        let stats = context.get("processing_stats") || { 
            processed: 0, 
            errors: 0, 
            last_error: null 
        };
        stats.errors++;
        stats.last_error = new Date().toISOString();
        context.set("processing_stats", stats);

        // Update node status to show error
        node.status({
            fill: "red",
            shape: "dot",
            text: `Error: ${error.message}`
        });

        node.error(`Error in processVoicemail: ${error.message}`, msg);
        
        // Return error message for Slack
        return {
            topic: "chat.postMessage",
            payload: {
                channel: config.slackChannel || "general",
                text: `❌ Error processing voicemail: ${error.message}`,
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `❌ *Error Processing Voicemail*\n${error.message}`
                        }
                    }
                ]
            },
            error: error.message,
            originalPayload: msg.payload,
            processed_at: new Date().toISOString(),
            stats: stats
        };
    }
}

// Process the voicemail message using Node-RED function node pattern
try {
    // Input validation
    if (!msg) {
        node.error("No message received", msg);
        return null;
    }
    
    // Process and return the result
    return processVoicemail(msg);
    
} catch (error) {
    node.error(`Critical error in voicemail processing: ${error.message}`, msg);
    
    // Update node status to show critical error
    node.status({
        fill: "red",
        shape: "dot",
        text: "Critical error"
    });
    
    // Return null to stop processing
    return null;
}
