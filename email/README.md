# Email Processing Scripts

This folder contains scripts for processing various email notifications in the Node-RED home automation system.

## Voicemail to Slack Transfer (`email_to_slack.js`)

This script processes FreePBX voicemail notifications and formats them for posting to Slack channels.

### Features

- **Automatic Parsing**: Extracts caller information, duration, date, and mailbox details from voicemail emails
- **Slack Formatting**: Creates clean Slack messages with blocks and fields
- **Email Authorization**: Only processes emails from authorized senders
- **User Mentions**: Automatically mentions specified Slack members
- **Error Handling**: Graceful error handling with fallback messages
- **Environment Variables**: Uses configurable Slack channel and member mentions

### Environment Variables Required

Set these in your Node-RED environment or system environment:

```bash
SLACK_CHANNEL_VOICEMAIL=C1234567890  # Your Slack channel ID
SLACK_MEMBER_BETTY=U9876543210      # Betty's Slack user ID for mentions
AUTHORIZED_EMAIL=office@ksplbg.com   # Authorized email sender
```

**Important**: Make sure these environment variables are properly set in your
Node-RED settings.js file or deployment environment. The script includes fallback
handling for missing variables.

### Node-RED Environment Variables

This script uses Node-RED's `env.get()` function to access environment variables,
which is the proper way to access them in function nodes:

```javascript
const slackChannel = env.get("SLACK_CHANNEL_VOICEMAIL");
const authorizedEmail = env.get("AUTHORIZED_EMAIL");
```

This is different from `process.env` which is not available in Node-RED function nodes.

### Usage in Node-RED

1. **Email Input Node**: Configure to receive voicemail emails from your PBX system
2. **Function Node**: Use this script to process the email
3. **Slack Output Node**: Send the formatted message to Slack

#### Node-RED Flow Example

```
[Email Input] → [Function Node (email_to_slack.js)] → [Slack Output]
```

#### Function Node Configuration

- **Function**: Copy the contents of `email_to_slack.js`
- **Outputs**: 1 output
- **Name**: Process Voicemail for Slack

### Message Format

The script expects input messages in this format (from FreePBX voicemail notifications):

```json
{
  "payload": "GVM,\n\nThere is a new voicemail in mailbox 6000:\n\n\tFrom:\t\"WIRELESS CALLER\" <14025406445>\n\tLength:\t0:04 seconds\n\tDate:\tWednesday, June 04, 2025 at 11:22:37 AM\n...",
  "topic": "FreePBX Voicemail Notification",
  "date": "2025-06-04T16:22:37.000Z",
  "attachments": [
    {
      "contentType": "audio/x-wav",
      "filename": "msg0015.wav",
      "content": "...base64 encoded audio..."
    }
  ]
}
```

**Note**: The script can handle voicemail emails with attachments, but attachments are not passed through to Slack.

### Output Format

The script outputs a Slack message object in the format expected by the Slack node:

```json
{
  "topic": "chat.postMessage",
  "payload": {
    "channel": "your-channel",
    "text": "📞 New Voicemail Received! @betty",
    "blocks": [
      {
        "type": "header",
        "text": {
          "type": "plain_text",
          "text": "📞 New Voicemail"
        }
      },
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": "*From:* \"WIRELESS CALLER\" <14025406445>"
          },
          {
            "type": "mrkdwn",
            "text": "*Duration:* 0:04 seconds"
          },
          {
            "type": "mrkdwn",
            "text": "*Date:* Wednesday, June 04, 2025 at 11:22:37 AM"
          },
          {
            "type": "mrkdwn",
            "text": "*Mailbox:* 6000"
          }
        ]
      }
    ]
  },
  "originalVoicemail": "...original payload...",
  "voicemailInfo": {
    "mailbox": "6000",
    "from": "\"WIRELESS CALLER\" <14025406445>",
    "length": "0:04 seconds",
    "date": "Wednesday, June 04, 2025 at 11:22:37 AM"
  }
}
```

**Note**: The script creates clean, focused messages with caller information and
automatically mentions the configured Slack member (@SLACK_MEMBER_BETTY).

### Slack Integration

The output is designed to work with the Node-RED Slack nodes. The script automatically sets:

- **Topic**: `chat.postMessage` (Slack Web API method)
- **Payload**: Complete message object with channel, text, and blocks

Make sure your Slack node is configured with:

- **Token**: Your Slack bot token with appropriate permissions
- **Channel**: The channel ID (can be overridden by the script)
- **Username/Icon**: Optional bot appearance settings

### Required Slack Permissions

Your Slack app/bot needs these permissions:

- `chat:write` - Send messages

### Error Handling

If parsing fails, the script will send an error message to Slack instead of crashing
the flow. Check the debug output for detailed error information.

### Testing

You can test the script by creating a sample message in Node-RED's debug nodes
or by running it directly in a function node with test data.
