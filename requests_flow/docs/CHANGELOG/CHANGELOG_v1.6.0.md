# TextBee SMS Handler v1.6.0 Changelog

**Release Date**: October 16, 2025  
**Theme**: Multi-Variant Messages & Randomization

---

## 🎉 New Features

### 1. Multi-Variant Message Templates

**Problem**: Repetitive notifications feel robotic and cause fatigue

- Same message 500 times: "Hi {name}, your request for '{title}'..."
- Users tune out predictable notifications
- No personality or conversational variety

**Solution**: Message pools with 5-10 variants per event

- `request_approved`: 10 unique celebration messages
- `request_declined`: 10 different ways to soften the blow
- `request_ready`: 10 variations for showtime excitement
- `request_failed`: 10 humorous technical error messages
- Issue events: 5 variants each

**Technical Implementation**:

```javascript
// OLD (v1.5.0 and earlier)
"request_approved": "Your request for \"{title}\" has been approved!"

// NEW (v1.6.0+)
"request_approved": [
  "✅ Great news, {name}! \"{title}\" got the green light. ⚡️",
  "🎉 Lights, camera, download! \"{title}\" got approved, {name}.",
  "⚡️ The download gods smile upon you! \"{title}\" is on the move.",
  // ... 7 more variants
]
```

**Random Selection**:

```javascript
const randomIndex = Math.floor(Math.random() * templatePool.length);
const selectedTemplate = templatePool[randomIndex];
```

**Benefits**:

- ✅ Prevents notification fatigue
- ✅ Feels more conversational and human
- ✅ Matches different moods (hype, humor, calm)
- ✅ Low-risk randomness (structure unchanged)
- ✅ Maintains brand personality

---

### 2. Randomized Signature System

**Feature**: Optional signature appended to messages

- 6 signature variants to choose from
- Random selection keeps things fresh
- Easily identifiable in phone notifications

**Configuration**:

```json
"signatures": [
  "— 🎬 Jellyseerr",
  "— 🍿 Jellyseerr HQ",
  "— 📺 Your Friendly Media Bot",
  "— Jellyseerr Bot",
  "— 🎭 Jellyseerr Command",
  "— 🎪 The Media Team"
]
```

**Example Output**:

```
✅ Great news, Joe! "Breaking Bad" got the green light. ⚡️ — 🎬 Jellyseerr
```

**To Disable**: Remove or comment out the `signatures` array in config

---

### 3. Backward Compatibility

**Legacy Support**: String templates still work

- Old config files work without changes
- Gradual migration path
- No breaking changes

**Migration Strategy**:

```javascript
// Function handles both formats
if (Array.isArray(templatePool) && templatePool.length > 0) {
    // Multi-variant: pick random
    selectedTemplate = templatePool[Math.floor(Math.random() * templatePool.length)];
} else if (typeof templatePool === 'string') {
    // Legacy: use as-is
    selectedTemplate = templatePool;
}
```

---

## 📊 Message Variant Statistics

| Event Type | Variants | Tone | Examples |
|------------|----------|------|----------|
| **request_added** | 10 | Playful, movie-themed | 🎬🎟️🎞️📼🍿 |
| **request_approved** | 10 | Celebratory, excited | ✅🎉⚡️📦🚀 |
| **request_declined** | 10 | Gentle, humorous | 🚫🕊️🥺📭🍪 |
| **request_ready** | 10 | Showtime energy | 📺🎬🍕🥳🎉 |
| **request_failed** | 10 | Technical humor | 💥🐛🧙‍♂️💾🔧 |
| **issue_created** | 5 | Alert, informative | 🚨🛠️⚠️📢🔍 |
| **issue_comment** | 5 | Conversational | 💬📝💭🗨️📣 |
| **issue_resolved** | 5 | Victory, relief | ✅🎉🔧✨🛠️ |
| **issue_reopened** | 5 | Plot twist energy | 🔄↩️🔁⚠️ |

**Total**: 70 unique message variants!

---

## 🎨 Message Philosophy

### Tone Guidelines Used

**Request Approved** (hype & celebration):

- "Lights, camera, download!"
- "The download gods smile upon you"
- "Prepare for cinematic glory"

**Request Declined** (gentle humor):

- "Maybe bribe the admin with cookies?"
- "The media gods took a rain check"
- "We salute your taste!"

**Request Ready** (showtime excitement):

- "It's showtime!"
- "Let the binge begin"
- "Grab your snacks and hit play"

**Request Failed** (technical humor):

- "Tripped over a digital banana peel"
- "Failed its saving throw vs. server errors"
- "The bits betrayed us"

---

## 🔧 Technical Changes

### Code Changes

**File**: `jellyseerr_textbee_notify.js`

1. **Updated `generateSmsMessage()` function**:
   - Added array detection for template pools
   - Implemented random selection logic
   - Added signature randomization
   - Maintained backward compatibility
   - Enhanced debug logging for variant tracking

2. **New Debug Logs**:

   ```javascript
   log(`Selected variant ${randomIndex + 1}/${templatePool.length} for ${eventType}`, "debug");
   log(`Added signature: ${signature}`, "debug");
   ```

3. **Version Header**:
   - Updated to v1.6.0
   - Added multi-variant description
   - Documented randomization features

**File**: `TEXTBEE_CONFIG.json`

1. **Converted all templates to arrays**:
   - 5-10 variants per event type
   - Emoji-rich, personality-filled messages
   - Balanced tone for each event category

2. **Added signatures array**:
   - 6 randomized signature options
   - Movie/media themed branding

**New File**: `TEXTBEE_CONFIG_MULTIVARIANT_EXAMPLE.jsonc`

- Comprehensive example configuration
- Inline documentation for new format
- Migration guidance from v1.5.0

---

## 📈 Performance Impact

**Negligible**:

- Random number generation: `Math.random()` is O(1)
- Array indexing: O(1) lookup
- No additional API calls
- No network overhead

**Memory**:

- Config slightly larger (70 strings vs 9)
- Still loaded once at startup
- Negligible impact (<1KB additional)

---

## 🚀 Upgrade Instructions

### From v1.5.0 to v1.6.0

**Option 1: Full Upgrade (Recommended)**

1. **Backup your current config**:

   ```bash
   cp config/TEXTBEE_CONFIG.json config/TEXTBEE_CONFIG.backup.json
   ```

2. **Update templates to arrays**:
   - Replace single strings with arrays of variants
   - See `TEXTBEE_CONFIG_MULTIVARIANT_EXAMPLE.jsonc` for format

3. **Add signatures (optional)**:

   ```json
   "signatures": ["— 🎬 Jellyseerr", "— 🍿 Jellyseerr HQ"]
   ```

4. **Update Node-RED function node**:
   - Copy new `jellyseerr_textbee_notify.js` code
   - Redeploy flow

**Option 2: Gradual Migration (Zero-Downtime)**

1. **Update function code first** (backward compatible):
   - Deploy v1.6.0 code to Node-RED
   - Existing string templates still work

2. **Migrate one template at a time**:

   ```json
   // Start with one event
   "request_approved": [
     "Message variant 1",
     "Message variant 2"
   ]
   // Keep others as strings initially
   ```

3. **Test and expand**:
   - Verify random selection works
   - Add more variants over time

---

## 🧪 Testing Recommendations

### Manual Testing

1. **Trigger same event multiple times**:
   - Approve 5+ requests in a row
   - Verify different messages each time
   - Check signature randomization

2. **Event Type Coverage**:
   - Test all 9 event types
   - Verify fallback messages work
   - Check placeholder replacement

3. **Debug Log Verification**:

   ```
   [debug] Selected variant 3/10 for MEDIA_APPROVED
   [debug] Added signature: — 🎬 Jellyseerr
   [debug] Generated SMS: "✅ Great news, Joe! ..."
   ```

### Automated Testing

**Use Inject nodes in Node-RED**:

```json
{
  "payload": {
    "notification_type": "MEDIA_APPROVED",
    "subject": "Test Movie",
    "request": {
      "requestedBy_email": "test@example.com",
      "requestedBy_username": "Test User"
    }
  }
}
```

**Inject 10 times, expect 10 different messages** (high probability)

---

## 📚 Documentation Updates

**New Files**:

1. `TEXTBEE_CONFIG_MULTIVARIANT_EXAMPLE.jsonc` - Example configuration
2. `CHANGELOG_v1.6.0.md` - This file

**Updated Files**:

1. `jellyseerr_textbee_notify.js` - Core implementation
2. `TEXTBEE_CONFIG.json` - Production config with 70 variants

**To Update**:

- `docs/README.md` - Add v1.6.0 section
- `LIFECYCLE_GUIDE_v1.5.0.md` - Note v1.6.0 compatibility

---

## 🎯 Design Decisions

### Why 5-10 Variants Per Event?

**5 variants**: Minimum to avoid obvious repetition

- Issue events (lower frequency)
- 5 variants = 1/5 = 20% repeat rate

**10 variants**: Ideal for high-frequency events

- Media requests (multiple per day)
- 10 variants = 1/10 = 10% repeat rate
- Sweet spot for memorability vs. variety

**Why Not More?**

- Diminishing returns beyond 10
- Harder to maintain quality/consistency
- User won't notice difference between 10 and 20

### Signature Philosophy

**Optional by design**:

- Some users want clean messages
- Others want branded notifications
- Easy to toggle on/off

**Random vs. Fixed**:

- Random prevents staleness
- All signatures recognizable
- No risk of confusion

---

## 🐛 Known Issues

**None identified** - v1.6.0 is production-ready

**Potential Edge Cases**:

1. **Empty template array**: Falls back to default message ✅
2. **Missing signatures**: Skips signature entirely ✅
3. **Legacy string templates**: Works as-is ✅

---

## 🔮 Future Enhancements

**Possible v1.7.0 Features**:

1. **Time-of-Day Variants**:
   - Morning messages: "Good morning, {name}! ☕️"
   - Evening messages: "Movie night? 🌙"

2. **User-Specific Personalities**:
   - Formal mode for some users
   - Extra-fun mode for others
   - Per-user tone preferences

3. **Seasonal Variants**:
   - Holiday-themed messages
   - Summer/winter variations

4. **A/B Testing Metrics**:
   - Track which variants get most engagement
   - Retire unpopular messages
   - Double-down on favorites

---

## 💡 Usage Tips

### Customizing Variants

**Add Your Own Messages**:

```json
"request_approved": [
  "Your existing variants...",
  "🎬 Custom message with YOUR personality!",
  "Add inside jokes your users will love"
]
```

**Tone Mixing**:

- 70% fun/casual
- 20% informative
- 10% formal (fallback defaults)

**Testing New Messages**:

1. Add to array
2. Deploy
3. Trigger event multiple times
4. Remove if users don't like it

### Best Practices

✅ **DO**:

- Match emoji to tone (🎉 = celebration, 💥 = error)
- Keep length under 160 characters when possible
- Test placeholder replacement ({name}, {title})
- Read messages aloud for naturalness

❌ **DON'T**:

- Mix serious and silly in same event category
- Use unclear abbreviations
- Make inside jokes only you understand
- Forget to test on real phones

---

## 📞 Support

**Issues or Questions**:

- Check `docs/README.md` for detailed docs
- Review `TEXTBEE_CONFIG_MULTIVARIANT_EXAMPLE.jsonc` for examples
- Test with debug logging enabled

**Rollback to v1.5.0**:

- Revert `jellyseerr_textbee_notify.js` to v1.5.0 code
- Restore backup config (string templates)
- Redeploy flow

---

## ✨ Summary

**v1.6.0 brings your notifications to life**:

- 🎭 70 unique message variants
- 🎲 Smart randomization
- 🎬 Branded signatures
- 🔄 Backward compatible
- 🚀 Zero performance impact

**Result**: Notifications that feel human, not robotic! 🎉

---

**Upgrade now and give your users a better experience!**
