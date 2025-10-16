# Multi-Variant Messages - Quick Guide

**Version**: 1.6.0+  
**Feature**: Randomized message variants to prevent notification fatigue

---

## 🎯 What Changed

**Before (v1.5.0)**:

```json
"request_approved": "Your request for \"{title}\" has been approved!"
```

**After (v1.6.0)**:

```json
"request_approved": [
  "✅ Great news, {name}! \"{title}\" got the green light. ⚡️",
  "🎉 Lights, camera, download! \"{title}\" got approved, {name}.",
  "⚡️ The download gods smile upon you! \"{title}\" is on the move.",
  "📦 Approved and inbound — \"{title}\" is being delivered fresh!",
  "🚀 \"{title}\" is clear for landing. Prepare for glory!",
  "🎬 Action! \"{title}\" got approval and is downloading.",
  "💚 Green light! \"{title}\" is racing to your library.",
  "🎊 Pop the confetti! \"{title}\" has been approved.",
  "⚡️ Approved at light speed! \"{title}\" will be ready soon.",
  "🎯 Bullseye! \"{title}\" passed the vibe check."
]
```

**Result**: Each notification picks a random variant!

---

## 📊 Current Variants

| Event | Variants | Tone |
|-------|----------|------|
| **request_added** | 10 | Playful, movie-themed 🎬 |
| **request_approved** | 10 | Celebratory 🎉 |
| **request_declined** | 10 | Gentle humor 🍪 |
| **request_ready** | 10 | Showtime energy 📺 |
| **request_failed** | 10 | Technical humor 💥 |
| **issue_created** | 5 | Alert 🚨 |
| **issue_comment** | 5 | Conversational 💬 |
| **issue_resolved** | 5 | Victory ✅ |
| **issue_reopened** | 5 | Plot twist 🔄 |

**Total**: 70 unique messages

---

## 🎲 How It Works

```javascript
// Pick random index from array
const randomIndex = Math.floor(Math.random() * templatePool.length);
const selectedTemplate = templatePool[randomIndex];

// Add random signature (optional)
const signature = signatures[Math.floor(Math.random() * signatures.length)];
message = `${message} ${signature}`;
```

**Example Output**:

```
✅ Great news, Joe! "Breaking Bad" got the green light. ⚡️ — 🎬 Jellyseerr
```

---

## 🚀 Quick Setup

### 1. Update Config (3 options)

**Option A: Copy production config**

```bash
# Use pre-made config with all 70 variants
cp config/TEXTBEE_CONFIG.json.example config/TEXTBEE_CONFIG.json
```

**Option B: Copy example and customize**

```bash
# Start with documented example
cp config/TEXTBEE_CONFIG_MULTIVARIANT_EXAMPLE.jsonc config/TEXTBEE_CONFIG.json
# Edit to add your own personality
```

**Option C: Keep current config (works as-is!)**

- v1.6.0 code is backward compatible
- String templates still work
- Migrate gradually when ready

### 2. Update Node-RED Function

1. Open Function node in Node-RED
2. Copy new code from `jellyseerr_textbee_notify.js` (v1.6.0)
3. Deploy
4. Test!

---

## ✅ Testing

**Send multiple notifications**:

1. Approve 5+ requests in a row
2. Verify different messages each time
3. Check debug logs:

   ```
   [debug] Selected variant 3/10 for MEDIA_APPROVED
   [debug] Added signature: — 🎬 Jellyseerr
   ```

---

## 🎨 Customization

### Add Your Own Variants

```json
"request_approved": [
  "Your existing 10 variants...",
  "🎬 NEW: Your custom message here!",
  "🎉 Add as many as you want!"
]
```

### Disable Signatures

```json
// Remove or comment out
// "signatures": [...]
```

### Adjust Variant Count

- **Minimum**: 2 variants per event
- **Recommended**: 5-10 variants
- **Maximum**: Whatever you can maintain!

---

## 📚 Full Documentation

- **Detailed Changelog**: `CHANGELOG_v1.6.0.md`
- **Example Config**: `TEXTBEE_CONFIG_MULTIVARIANT_EXAMPLE.jsonc`
- **Technical Docs**: `docs/README.md`
- **Lifecycle Guide**: `LIFECYCLE_GUIDE_v1.5.0.md`

---

## 💡 Why Multi-Variant?

✅ **Prevents notification fatigue** - Fresh message every time  
✅ **Feels human** - Not robotic repetition  
✅ **Matches moods** - Excitement, humor, empathy  
✅ **Low risk** - Structure unchanged, just personality  
✅ **Backward compatible** - Old configs still work  

---

**Enjoy your more human notifications! 🎉**
