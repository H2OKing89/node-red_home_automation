# Node-RED Home Automation - AI Coding Instructions

## Project Overview

This is a **Node-RED based home automation system** integrated with Home Assistant, not a traditional application codebase. Each `.js` file is a **Function node** executed within Node-RED's runtime environment.

**Critical Context**: These are NOT standalone Node.js scripts. They run inside Node-RED Function nodes with:
- Limited Node.js API access (no `require()`, `fs`, etc.)
- Message-passing architecture (`msg` object)
- Scoped contexts (`context`, `flow`, `global`)
- Node-RED-specific APIs (`node.send()`, `node.done()`, `node.status()`)

## Architecture & Flow Organization

### Flow-Based Structure
The codebase is organized by **automation domains** (flows), not traditional MVC patterns:
- `alarm_flow/` - Multi-state security system with duress protocols
- `weather_flow/` - NWS alert processing with geographic filtering
- `north_garage_flow/` - Automated garage control with person detection
- `nfc_tags_flow/` - NFC tag triggered automations
- `requests_flow/` - Jellyseerr webhook integrations
- `alarm_clock_flow/` - Wake-up scheduler with TTS variations

Each flow contains multiple `.js` Function nodes that communicate via message passing.

### State Management
- **Context Storage**: Node-scoped (`context`), flow-scoped (`flow`), or global (`global`)
- **Global Config**: `config/node-red_global.json` contains Discord IDs, API tokens, entity mappings
- **Sync Script**: `sync_global_json.py` syncs config between local dev and remote Node-RED server
- **Environment Variables**: Used via `env.get()` for notification messages and mappings (see alarm_flow v1.6.0+)

## Node-RED Function Node Patterns

### Required Practices (Always Follow)

1. **Async Completion Tracking**
```javascript
// Always call node.done() when async work completes
(async () => {
  try {
    await doWork();
    node.send(msg);
  } catch (e) {
    node.error(e, msg);  // Triggers Catch nodes
  } finally {
    node.done();  // NR >= 1.0 requirement
  }
})();
return;  // Don't return msg synchronously
```

2. **Visual Status Updates**
```javascript
node.status({ fill: 'blue', shape: 'dot', text: 'Processing...' });
// Green = success, Red = error, Yellow = warning
node.status({ fill: 'green', shape: 'dot', text: 'Complete' });
```

3. **Message Object Preservation**
```javascript
// PRESERVE msg object properties (especially msg.req, msg.res, msg.data)
msg.payload = transform(msg.payload);
return msg;

// DON'T create new objects unless absolutely necessary
// return { payload: x };  // ⚠️ Loses context
```

4. **Error Handling with Catch Node Support**
```javascript
node.error(error, msg);  // Pass msg to route to Catch nodes
```

### External Modules Configuration

Modules are declared in Function node **Setup tab** (NR >= 1.3), not via `require()`:

**Standard Module Trio**:
- `date-fns` (3.6.0+) as `dateFns` - Date manipulation
- `date-fns-tz` (2.0.0+) as `dateFnsTz` - Timezone handling
- `suncalc` (1.9.0+) as `suncalc` - Solar calculations

**Always verify availability**:
```javascript
if (!dateFnsTz?.formatInTimeZone) {
    node.error('date-fns-tz not available - add in Setup tab', msg);
    return null;
}
```

**Global modules** (via `settings.js` `functionGlobalContext`):
- `axios` - HTTP requests (available as `global.get('axios')`)
- Pushover tokens: `global.get('pushoverTokens')`
- User keys: `global.get('pushoverUserKeys')`

### Logging Standards

```javascript
const LOGGING_ENABLED = true;  // Toggle for production

function log(message, level = "info") {
    if (!LOGGING_ENABLED) return;
    if (level === "error") node.error(message);
    else if (level === "warn") node.warn(message);
    else node.log(message);
}
```

**Usage**:
- `node.log()` - Important automation events
- `node.warn()` - Expected conditions preventing automation
- `node.debug()` - Non-critical flow control info
- `node.error()` - Unexpected errors needing attention

## Home Assistant Integration

### Entity ID Patterns
- Alarm: `alarm_control_panel.alarmo`
- Covers: `cover.garage_door`
- Sensors: `binary_sensor.garage_motion`
- Cameras: `binary_sensor.g5_flex_north_garage_person_detected`
- Speakers: `media_player.sonos_1`, `media_player.house_google_speakers`

### Message Structure from HA Nodes
```javascript
// Home Assistant event node output
msg.data.event.new_state.state          // Current state
msg.data.event.old_state.state          // Previous state
msg.data.event.new_state.attributes     // Entity attributes
msg.topic                                // Entity ID
```

## Notification System Patterns

### Multi-Platform TTS (Text-to-Speech)
Supports both Sonos and Google Home speakers:
```javascript
const config = {
    devices: {
        sonos: ["media_player.sonos_1", "media_player.era_100"],
        google: ["media_player.house_google_speakers"]
    },
    volumes: { sonos: 100, google: 1.0 }
};
```

### Push Notifications
Uses device mapping from environment variables (NR >= 1.6.0):
```javascript
const notifyMapAndroid = JSON.parse(env.get("NOTIFY_MAP_ANDROID"));
// Maps person.entity_id to notify.mobile_app_device
```

**Android payload supports HTML**:
```javascript
message: `\u200B<b><span style="color: red">Alert</span></b>`
```

**iOS requires stripped HTML**:
```javascript
function stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\u200B/g, '');
}
```

## Time & Date Handling

**Always use America/Chicago timezone** with `date-fns-tz`:

```javascript
const TIME_ZONE = 'America/Chicago';
const FORMATS = {
    push: "MMMM do, yyyy h:mm a zzz",      // "October 5th, 2025 3:30 PM CDT"
    tts: "MMMM do, yyyy 'at' h:mm a zzz",  // Voice-friendly
    iso: "yyyy-MM-dd HH:mm:ss"
};

const { formatInTimeZone } = dateFnsTz;
const formatted = formatInTimeZone(new Date(), TIME_ZONE, FORMATS.push);
```

## Critical Security Patterns

### Duress Code System
The alarm system includes silent duress detection (`alarm_flow/alarm_state_group/alarm_duress_processor.js`):
- Triggers emergency SMS/Discord without visible alarm
- Sends law enforcement contact info
- Uses passphrase system for verification

**Never log or expose duress codes in debug output**.

### State Transition Validation
```javascript
function isStateTransition(oldState, newState) {
    return oldState && newState && oldState !== newState;
}
// Prevents duplicate processing on attribute changes
```

## Development Workflows

### Testing Changes
1. Edit `.js` file locally
2. Import into Node-RED (Menu → Import → Clipboard)
3. Deploy and test with Inject nodes
4. Monitor Debug sidebar for output

### Syncing Global Config
```bash
python sync_global_json.py  # Syncs config/node-red_global.json to server
```

### Module Requirements
Python dependencies for sync script:
```bash
pip install -r requirements.txt  # requests, python-dotenv, rich
```

Node-RED palettes:
- `node-red-contrib-home-assistant-websocket` (required)
- `node-red-contrib-sun-position` (optional)

Enable external modules in `settings.js`:
```javascript
functionExternalModules: true,
```

## Documentation References

- **Function Node Guide**: `docs/function_node/node_red_function_node_practical_guide.md` - Comprehensive Node-RED patterns
- **Module Docs**: `docs/modules/` - date-fns, suncalc integration examples
- **Flow READMEs**: Each flow has detailed architecture diagrams and setup instructions

## Common Pitfalls

1. **Don't use `require()`** - Declare modules in Setup tab
2. **Don't forget `node.done()`** - Required for async functions
3. **Don't create new msg objects** - Preserve original context
4. **Don't assume entity IDs** - They're user-specific, update examples
5. **Don't skip timeout config** - Set in Setup tab for long-running functions (30-60s recommended)
6. **Don't forget null checks** - `msg.data?.event?.new_state?.attributes?.Alerts`

## Version Tracking

Include version headers in Function nodes:
```javascript
/**
 * Script Name: [Descriptive Name]
 * Version: X.Y.Z
 * Date: YYYY-MM-DD
 * Changelog:
 * - X.Y.Z: Added node.status(), node.done(), enhanced error handling
 */
```

See `CHANGELOG.md` for project-wide version history and migration notes.
