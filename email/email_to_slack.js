// Voicemail to Slack Transfer Script for Node-RED
// This script processes FreePBX voicemail notifications and formats them for Slack

// Access environment variables using Node-RED's env.get()
const slackChannel = env.get("SLACK_CHANNEL_VOICEMAIL");
const slackMember = env.get("SLACK_MEMBER_BETTY");
const authorizedEmail = env.get("AUTHORIZED_EMAIL");

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

        return null;
    } catch (error) {
        node.warn(`Error extracting sender email: ${error.message}`);
        return null;
    }
}

// Function to parse voicemail payload
function parseVoicemailPayload(payload) {
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

    return voicemailInfo;
}

// Function to format Slack message
function formatSlackMessage(voicemailInfo, originalMsg) {
    const callerName = voicemailInfo.from || 'Unknown Caller';
    const duration = voicemailInfo.length || 'Unknown duration';
    const voicemailDate = voicemailInfo.date || new Date().toLocaleString();

    // Create a formatted Slack message
    let message = {
        channel: slackChannel,
        text: `📞 New Voicemail Received!`,
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "📞 New Voicemail"
                }
            },
            {
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
            }
        ]
    };

    // Add mention to Betty if specified
    if (slackMember) {
        message.text += ` <@${slackMember}>`;
    }

    // Add action buttons
    message.blocks.push({
        type: "actions",
        elements: [
            {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Listen to Voicemail"
                },
                style: "primary",
                action_id: "listen_voicemail"
            },
            {
                type: "button",
                text: {
                    type: "plain_text",
                    text: "Mark as Read"
                },
                action_id: "mark_read"
            }
        ]
    });

    return message;
}

// Main processing function
function processVoicemail(msg) {
    try {
        // Check if email is from authorized sender
        if (authorizedEmail) {
            const senderEmail = extractSenderEmail(msg);
            if (!senderEmail || senderEmail.toLowerCase() !== authorizedEmail.toLowerCase()) {
                node.warn(`Unauthorized email sender: ${senderEmail}. Expected: ${authorizedEmail}`);
                return null; // Don't process unauthorized emails
            }
        }

        // Parse the voicemail payload
        const voicemailInfo = parseVoicemailPayload(msg.payload);

        // Format for Slack
        const slackMessage = formatSlackMessage(voicemailInfo, msg);

        // Return the formatted message for Slack node
        return {
            topic: "chat.postMessage",
            payload: slackMessage,
            originalVoicemail: msg.payload,
            voicemailInfo: voicemailInfo
        };

    } catch (error) {
        // Error handling
        return {
            topic: "chat.postMessage",
            payload: {
                channel: slackChannel,
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
            originalPayload: msg.payload
        };
    }
}

// Export for Node-RED or direct execution
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { processVoicemail, parseVoicemailPayload, formatSlackMessage };
}

// For Node-RED function node usage
if (typeof msg !== 'undefined') {
    return processVoicemail(msg);
}
