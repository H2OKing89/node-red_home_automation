# Node-RED Notification System - Improvement Roadmap

**Generated:** August 25, 2025  
**Source:** ChatGPT Analysis & Review  
**Status:** Future Enhancements - For Review & Implementation

---

## Current Status ✅

Your notification system is **functionally solid** with:

- Clean structure and logical separation (Android/iOS + Push/TTS)
- Proper environment variable usage
- Good error handling and logging
- Platform-specific formatting

---

## Identified Improvement Areas

### 1. **Correctness & Data Types**

**Priority:** Medium | **Risk:** Low

**Issue:** Mixed data types in payloads

```javascript
// Current (strings)
sticky: 'true'
when: 60

// Recommended (proper types)  
sticky: true
// Remove chronometer/when/when_relative unless actually needed
```

**Action Items:**

- [ ] Convert string booleans to actual booleans
- [ ] Review Android notification timing fields
- [ ] Clean up unnecessary title quotes

---

### 2. **Enhanced Environment Variable Parsing**

**Priority:** Medium | **Risk:** Low

**Current Issue:** Generic error handling for JSON parsing

**Recommended Helper Function:**

```javascript
function parseMap(raw, name) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); }
    catch (e) { node.error(`${name} is invalid JSON: ${e.message}`); return {}; }
  }
  if (typeof raw === 'object') return raw;
  node.warn(`${name} is not an object or JSON string; defaulting to {}`);
  return {};
}
```

1. Enhanced error parsing
2. Data type corrections

**Action Items:**

- [ ] Implement specific parsing error messages
- [ ] Add validation for expected data types

---

### 3. **HTML Safety & Security**

**Priority:** High | **Risk:** Medium

**Issue:** User input not escaped before HTML insertion

**Recommended HTML Escape Function:**

```javascript
function escapeHtml(s='') {
  return String(s||'')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**Action Items:**

- [ ] Escape `msg.alarm.message` before HTML insertion
- [ ] Ensure iOS stripHtml function handles all cases

---

### 4. **Notification Storm Prevention**

**Priority:** High | **Risk:** Low

**Issue:** Potential duplicate notifications in rapid succession

**Recommended Cooldown Implementation:**

```javascript
function cooldown(key, seconds=30) {
  const now = Date.now();
  const last = context.get(key) || 0;
  if ((now - last) < seconds * 1000) return true; // still cooling
  context.set(key, now);
  return false;
}

// Usage
const dedupeKey = `push:${entityId}:alarmo_armed_status`;
if (cooldown(dedupeKey, 30)) {
  node.warn(`Cooldown active for ${entityId}, skipping duplicate push.`);
  return null;
}
```

**Action Items:**

- [ ] Implement per-entity cooldown for push notifications
- [ ] Implement per-device cooldown for TTS notifications
- [ ] Make cooldown duration configurable via environment variables

---

### 5. **Quiet Hours for TTS**

**Priority:** Medium | **Risk:** Low

**Issue:** TTS notifications at inappropriate times

**Recommended Quiet Hours Function:**

```javascript
function inQuietHours(range="22:00-07:00") {
  const [start, end] = range.split('-').map(t => t.trim());
  const now = new Date();
  const hm = (d) => d.getHours()*60 + d.getMinutes();
  function toMinutes(t) { const [h,m]=t.split(':').map(Number); return h*60+(m||0); }
  const s = toMinutes(start), e = toMinutes(end), n = hm(now);
  return s <= e ? (n >= s && n < e) : (n >= s || n < e);
}
```

**Action Items:**

- [ ] Implement quiet hours check for TTS notifications
- [ ] Add `QUIET_HOURS` environment variable
- [ ] Consider fallback to push notifications during quiet hours

---

### 6. **Configuration Externalization**

**Priority:** Low | **Risk:** Low

**Current Issue:** Hard-coded routes and URLs

**Recommended Additional Environment Variables:**

```bash
ALARM_ROUTE_APP=/lovelace-kiosk/Alarm
ALARM_ROUTE_WEB=https://homeassistant.example.com/lovelace-kiosk/Alarm
ALARM_ICON_URL=https://picsur.kingpaging.com/i/f75fabb5-fbda-492f-9d15-8f39f5bd17d1.png
IOS_CRITICAL_ALERTS=true
TTS_VOLUME=1.0
```

**Action Items:**

- [ ] Move click-action routes to environment variables
- [ ] Externalize icon URLs
- [ ] Make iOS critical alerts configurable
- [ ] Add TTS volume control

---

### 7. **Enhanced Tagging Strategy**

**Priority:** Low | **Risk:** Low

**Current:** Single global tag for all users  
**Consideration:** Per-user tags for individual notification management

```javascript
// Option A: Global (current)
tag: 'alarmo_armed_status'

// Option B: Per-user
tag: `alarmo_armed_status_${entityId}`
```

**Action Items:**

- [ ] Evaluate need for per-user vs global notification tiles
- [ ] Implement configurable tagging strategy

---

### 8. **iOS Optimization**

**Priority:** Low | **Risk:** Low

**Considerations:**

- Badge behavior (increment vs set)
- Critical alert permissions
- Sound customization

**Action Items:**

- [ ] Review badge increment behavior
- [ ] Make critical alerts configurable
- [ ] Test iOS notification behavior with various settings

---

### 9. **Message Length Safety**

**Priority:** Low | **Risk:** Low

**Issue:** Potential for very long dynamic messages

**Recommended Length Clamp:**

```javascript
function clamp(s, n=800) { 
  s = String(s||''); 
  return s.length>n ? s.slice(0,n-1)+'…' : s; 
}
```

**Action Items:**

- [ ] Implement message length limits
- [ ] Handle FCM payload size constraints

---

### 10. **Enhanced Observability**

#### Priority: Low | Risk: Low

**Ideas:**

- Notification delivery metrics
- Per-entity notification counts
- Performance monitoring

**Action Items:**

- [ ] Add notification metrics to global context
- [ ] Implement delivery success tracking
- [ ] Create notification dashboard data

---

## Recommended Environment Variable Examples

```bash
# Notification Maps (existing)
NOTIFY_MAP_ANDROID={
  "person.quentin": [
    "notify.mobile_app_pixel",
    "notify.mobile_app_tablet"
  ]
}
NOTIFY_MAP_IOS={
  "person.quentin": "notify.iphone_quentin"
}

# New Configuration Options
QUIET_HOURS=22:00-07:00
NOTIFICATION_COOLDOWN=30
TTS_COOLDOWN=20
ALARM_ROUTE_APP=/lovelace-kiosk/Alarm
ALARM_ICON_URL=https://example.com/alarm-icon.png
IOS_CRITICAL_ALERTS=true
TTS_VOLUME=1.0
MESSAGE_MAX_LENGTH=800
```

---

1. Enhanced error parsing
2. Data type corrections
3. Message length limits

### Phase 3 (Low Priority - Nice to Have)

1. Configuration externalization
2. Enhanced tagging strategy
3. Observability improvements

---

## Testing Checklist

When implementing improvements:

- [ ] Test with various `msg.alarm.message` content (HTML, special chars)
- [ ] Verify cooldown works across rapid-fire notifications
- [ ] Test quiet hours boundary conditions (midnight crossover)
- [ ] Validate JSON parsing with malformed environment variables
- [ ] Check iOS critical alert behavior with/without permissions
- [ ] Test notification replacement with updated tag strategies

---

## Notes

- **Backwards Compatibility:** All improvements should maintain current functionality
- **Incremental Implementation:** Each improvement can be implemented independently
- **Testing Environment:** Test all changes in non-production Node-RED first
- **Documentation:** Update JSDoc comments when implementing changes

---

*This roadmap serves as a living document for future enhancements to the
Node-RED notification system. Prioritize based on current pain points and
user feedback.*
