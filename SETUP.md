# Quick Setup Guide

This guide will get you up and running with the Node-RED Home Automation suite
in under 30 minutes.

## Prerequisites

✅ **Node-RED 3.x+** installed and running  
✅ **Home Assistant** with WebSocket API enabled  
✅ **Admin access** to Node-RED (for installing palettes)

## Step 1: Install Required Palettes

Open Node-RED → **Menu** → **Manage Palette** → **Install** tab

Copy and paste these palette names one by one:

```text
node-red-contrib-home-assistant-websocket
```

**Optional but recommended:**

```text
node-red-contrib-sun-position
```

## Step 2: Enable External Modules

1. Edit your Node-RED `settings.js` file
2. Find the line with `functionExternalModules` (around line 280)
3. Change it to: `functionExternalModules: true,`
4. **Restart Node-RED**

## Step 3: Configure Home Assistant Connection

1. In Home Assistant, go to **Profile** → **Long-Lived Access Tokens**
2. Click **Create Token**, give it a name like "Node-RED"
3. **Copy the token** (you won't see it again!)
4. In Node-RED, add a **Home Assistant WebSocket** node
5. Configure with your HA URL and the token

## Step 4: Import Your First Flow

Let's start with the garage automation as it's self-contained:

1. Copy the contents of `north_garage_flow/` JSON files
2. In Node-RED: **Menu** → **Import** → **Clipboard**
3. Paste the flow JSON
4. Click **Import**

## Step 5: Configure Modules in Function Nodes

For any Function node using dates or sun calculations:

1. **Double-click** the Function node
2. Go to **Setup** tab  
3. Add these modules:

| Module | Version | Variable Name |
|--------|---------|---------------|
| `date-fns` | 3.6.0+ | `dateFns` |
| `date-fns-tz` | 2.0.0+ | `dateFnsTz` |
| `suncalc` | 1.9.0+ | `suncalc` |

1. Click **Done**

## Step 6: Update Entity IDs

Find and replace these example entity IDs with your actual device IDs:

- `cover.garage_door` → Your garage door entity
- `binary_sensor.garage_motion` → Your motion sensor
- `light.garage_lights` → Your garage lights
- `media_player.sonos_1` → Your speaker entity

## Step 7: Test and Deploy

1. Click **Deploy** in Node-RED
2. Test with an **Inject** node
3. Check **Debug** sidebar for any errors
4. Monitor Node-RED logs for issues

## Quick Troubleshooting

**❌ "Module not found" errors?**

- Restart Node-RED after enabling `functionExternalModules`
- Check the Setup tab has correct module names

**❌ Home Assistant connection failed?**  

- Verify HA URL is accessible from Node-RED
- Check token hasn't expired
- Ensure WebSocket API is enabled in HA

**❌ Entity not found errors?**

- Update entity IDs to match your devices
- Check entity names in HA Developer Tools

## Next Steps

Once garage flow is working:

1. **Import alarm flows** - Start with `alarm_state_group/alarm_handler.js`
2. **Configure global context** - See main README Configuration section  
3. **Set up notifications** - Add Pushover/Gotify tokens
4. **Import weather flows** - Configure county filters

## Need Help?

- 📖 **Full documentation:** See [README.md](README.md)
- 🐛 **Issues:** Check [Troubleshooting section](README.md#troubleshooting)
- 💬 **Questions:** Open a GitHub issue

---

**Estimated setup time:** 15-30 minutes for first flow  
**Pro tip:** Start with one flow, get it working, then expand!
