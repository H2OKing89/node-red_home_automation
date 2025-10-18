# Home Assistant Notify Mobile App Payload Templates

_A comprehensive guide to constructing, sending, and handling Home Assistant mobile app_
_notifications—including advanced, actionable, and platform-specific options—for Node-RED and YAML automations._

## Index

- [Home Assistant Notify Mobile App Payload Templates](#home-assistant-notify-mobile-app-payload-templates)
  - [Index](#index)
  - [Platform-Specific Features: Android HTML \& TTS](#platform-specific-features-android-html--tts)
    - [Android HTML Support](#android-html-support)
    - [Android TTS (Text-to-Speech) Support](#android-tts-text-to-speech-support)
  - [iOS HTML \& TTS Support](#ios-html--tts-support)
  - [Basic Push Notification](#basic-push-notification)
  - [Advanced Notification with Options (Android/iOS)](#advanced-notification-with-options-androidios)
  - [Actionable Notification (Android Only)](#actionable-notification-android-only)
  - [iOS-Specific Options](#ios-specific-options)
  - [Best Practices](#best-practices)
  - [Home Assistant Actionable Notification Reference (YAML Examples \& Literature)](#home-assistant-actionable-notification-reference-yaml-examples--literature)
  - [Actionable Notifications (Official Home Assistant Literature)](#actionable-notifications-official-home-assistant-literature)
  - [Building Notification Action Scripts](#building-notification-action-scripts)
  - [Further Considerations](#further-considerations)
  - [Official Home Assistant Actionable Notification Literature](#official-home-assistant-actionable-notification-literature)
    - [Actionable Notifications](#actionable-notifications)
      - [iOS](#ios)
      - [Version Compatibility](#version-compatibility)
      - [Apple Watch](#apple-watch)
    - [Building actionable notifications](#building-actionable-notifications)
      - [Android specific options](#android-specific-options)
      - [iOS specific options](#ios-specific-options-1)
        - [Icon Values](#icon-values)
        - [uri values](#uri-values)
    - [Building notification action scripts](#building-notification-action-scripts-1)
    - [Further Considerations (Official Home Assistant Literature)](#further-considerations-official-home-assistant-literature)
      - [Blocking Behaviour](#blocking-behaviour)
      - [Catch All Triggers](#catch-all-triggers)
      - [Migrating from Categories](#migrating-from-categories)
    - [Compatibility with different devices](#compatibility-with-different-devices)
      - [iOS 13 and later](#ios-13-and-later)

---

## Platform-Specific Features: Android HTML & TTS

### Android HTML Support

Android Home Assistant mobile app notifications support HTML formatting in the `message` and `title` fields.
This allows you to use tags such as `<b>`, `<i>`, `<span style=...>`, and even zero-width characters for advanced formatting.
You can specify colors using either named colors (e.g., `red`, `blue`) or hex codes (e.g., `#e65100`, `#1565c0`).
Both methods have been tested and work reliably.

**Example using hex color codes:**

```json
{
  "action": "notify.mobile_app_<android_device>",
  "data": {
    "message": "\u200B<b><span style=\"color: #1565c0\">The garage door was left open for</span></b> \u200B<span style=\"color: #e65100\">3 minutes and 5 seconds</span></b> <b><span style=\"color: #1565c0\">and has been closed automatically.</span></b><br><span style=\"color: #888\">June 27th, 2025 3:00 PM CST</span>",
    "title": "\u200B<b><span style=\"color: #1565c0\">Garage Door Closed by Automation</span></b>",
    "data": {
      "priority": "high",
      "sticky": "true",
      "channel": "garage_alerts",
      "icon_url": "https://cdn-icons-png.flaticon.com/512/69/69524.png"
    }
  }
}
```

**Example using named colors:**

```json
{
  "action": "notify.mobile_app_<android_device>",
  "data": {
    "message": "<b><span style=\"color: blue\">This is blue text</span></b> <b><span style=\"color: red\">and this is red</span></b>",
    "title": "<b><span style=\"color: green\">Green Title</span></b>",
    "data": {
      "priority": "high"
    }
  }
}
```

You can reference the `garage_left_open_notify.js` script
for a real-world Node-RED example using hex color codes for advanced notification formatting.

> **Note:** iOS does not support HTML in notification payloads. Use plain text for iOS devices (see below for stripping HTML).

### Android TTS (Text-to-Speech) Support

Android devices can receive TTS notifications using the `media_stream` and `tts_text` fields.
This allows you to send spoken alerts directly to a user's device,
typically using the alarm or notification stream for maximum volume and urgency.

**Example:**

```json
{
  "action": "notify.mobile_app_<android_device>",
  "data": {
    "message": "TTS",
    "data": {
      "media_stream": "alarm_stream_max",
      "priority": "high",
      "ttl": 0,
      "tts_text": "Alarm is pending. Please disarm or leave the premises."
    }
  }
}
```

- `media_stream: "alarm_stream_max"` ensures the TTS is played at maximum volume, overriding Do Not Disturb.
- `tts_text` is the message that will be spoken.
- The `message` field should be set to "TTS" to trigger TTS behavior in the Home Assistant app.

**Node-RED Example:**

See the `pending_tts_mobile.js` script
for a Node-RED function that sends TTS to all mapped Android devices for a user when they are home.

---

## iOS HTML & TTS Support

iOS does **not** support HTML in notification payloads. All HTML tags should be stripped before sending to iOS devices.

> **Note:** TTS to mobile devices is only supported for Android.
> The Home Assistant mobile app for iOS does not support TTS notifications.
> For TTS on Apple devices, use Sonos, Google Cast, or other integrations.

---

## Basic Push Notification

**Service:** `notify.mobile_app_<device_name>`

**Payload Template:**

```json
{
  "action": "notify.mobile_app_<device_name>",
  "data": {
    "message": "YOUR_MESSAGE_HERE",
    "title": "YOUR_TITLE_HERE"
  }
}
```

**Example:**

```json
{
  "action": "notify.mobile_app_quentin_s25u",
  "data": {
    "message": "Alarm triggered!",
    "title": "Security Alert"
  }
}
```

---

## Advanced Notification with Options (Android/iOS)

**Payload Template:**

```json
{
  "action": "notify.mobile_app_<device_name>",
  "data": {
    "message": "YOUR_MESSAGE_HERE",
    "title": "YOUR_TITLE_HERE",
    "data": {
      "priority": "high",
      "sticky": "true",
      "channel": "alarm_stream",
      "ttl": 0,
      "color": "#FF0000",
      "timeout": 600,
      "tag": "alarmo_armed_status",
      "persistent": true,
      "importance": "high",
      "notification_icon": "mdi:alarm-light"
    }
  }
}
```

**Notes:**

- The nested `data` object inside `data` is required for advanced options (Android/iOS specific features).
- `priority`, `sticky`, `channel`, `ttl`, `color`, `timeout`, `tag`, `persistent`, `importance`, and `notification_icon`
  are all optional but recommended for alarm/critical notifications.

---

## Actionable Notification (Android Only)

**Payload Template:**

```json
{
  "action": "notify.mobile_app_<device_name>",
  "data": {
    "message": "Alarm failed to arm. Retry or force arm?",
    "title": "Alarm Failure",
    "data": {
      "priority": "high",
      "sticky": "true",
      "channel": "alarm_stream",
      "ttl": 0,
      "color": "#FF0000",
      "timeout": 600,
      "tag": "alarmo_armed_status",
      "persistent": true,
      "importance": "high",
      "notification_icon": "mdi:alarm-light",
      "actions": [
        { "action": "ALARMO_RETRY_ARM", "title": "Retry Arm" },
        { "action": "ALARMO_FORCE_ARM", "title": "Force Arm" }
      ]
    }
  }
}
```

**Notes:**

- The `actions` array defines buttons that appear in the notification (Android only).
- Each action must have a unique `action` string and a `title`.

---

## iOS-Specific Options

**Example:**

```json
{
  "action": "notify.mobile_app_<device_name>",
  "data": {
    "message": "Alarm triggered!",
    "title": "Security Alert",
    "data": {
      "push": {
        "sound": { "name": "default", "critical": 1, "volume": 1.0 },
        "interruption-level": "time-sensitive",
        "badge": 1
      },
      "persistent": true,
      "url": "/lovelace-kiosk/Alarm"
    }
  }
}
```

**Notes:**

- The `push` object allows for custom sounds, critical alerts, and interruption levels on iOS.
- `url` can be used to deep-link into a specific Lovelace dashboard or view.

---

## Best Practices

- Always test notifications on both Android and iOS devices, as some options are platform-specific.
- Use `priority: high` and `sticky: true` for critical alerts.
- Use the `actions` array for actionable notifications on Android.
- For iOS, use the `push` object for advanced notification features.
- Use unique `tag` values to group or replace notifications.
- Use `persistent: true` for notifications that should not be dismissed automatically.

---

## Home Assistant Actionable Notification Reference (YAML Examples & Literature)

The following section provides official Home Assistant documentation and YAML examples for actionable notifications.
These are useful for understanding how notification actions work natively in Home Assistant automations.

## Actionable Notifications (Official Home Assistant Literature)

Actionable notifications allow you to add buttons to notifications, which send events to Home Assistant when tapped.
These events can be used in automations to perform actions such as sounding alarms, opening doors, or running scripts.

**Example YAML:**

```yaml
service: notify.mobile_app_<your_device_id_here>
data:
  message: "Something happened at home!"
  data:
    actions:
      - action: "ALARM" # The key sent for the event
        title: "Sound Alarm" # Button title
      - action: "URI" # Use URI to open a URL
        title: "Open Url"
        uri: "https://google.com" # URL to open when action is selected
```

**Action Keys:**

- `action` (required): Identifier for the event. Use `REPLY` or set `behavior: textInput` to prompt for text.
- `title` (required): Button label.
- `uri` (optional): URL to open (set `action: URI`).
- `behavior` (optional): Set to `textInput` to prompt for text.

**iOS-specific options:**

- `activationMode`: `foreground` to launch app, `background` (default) to just fire event.
- `authenticationRequired`: Require passcode.
- `destructive`: Color title red.
- `textInputButtonTitle`, `textInputPlaceholder`: For text input actions.
- `icon`: Use SF Symbols (e.g., `sfsymbols:bell`).

**Android-specific options:**

- No additional keys at this time.

**Special URI Formats:**

- Open Lovelace view: `/lovelace/cameras`
- Open app: `app://com.twitter.android`
- Entity more info: `entityId:sun.sun`
- Notification history: `settings://notification_history`
- Intent scheme: `intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;end`
- Deep link: `deep-link://tel:2125551212`

**iOS Application Launch Example:**

```yaml
- action: "CALL"
  title: "Call Pizza Hut"
  uri: "tel:2125551212"
- action: "OPEN"
  title: "Open Safari"
  uri: "https://example.com"
```

## Building Notification Action Scripts

To avoid accidental triggers, use unique action IDs per script run:

```yaml
# inside a script or automation sequence
- alias: "Set up variables for the actions"
  variables:
    action_open: "{{ 'OPEN_' ~ context.id }}"
    action_close: "{{ 'CLOSE_' ~ context.id }}"
- alias: "Ask to close or open the blinds"
  service: notify.mobile_app_<your_device>
  data:
    message: "The blinds are half-open. Do you want to adjust this?"
    data:
      actions:
        - action: "{{ action_open }}"
          title: Open
        - action: "{{ action_close }}"
          title: Close
- alias: "Wait for a response"
  wait_for_trigger:
    - platform: event
      event_type: mobile_app_notification_action
      event_data:
        action: "{{ action_open }}"
    - platform: event
      event_type: mobile_app_notification_action
      event_data:
        action: "{{ action_close }}"
- alias: "Perform the action"
  choose:
    - conditions: "{{ wait.trigger.event.data.action == action_open }}"
      sequence:
        - service: cover.open_cover
          target:
            entity_id: cover.some_cover
    - conditions: "{{ wait.trigger.event.data.action == action_close }}"
      sequence:
        - service: cover.close_cover
          target:
            entity_id: cover.some_cover
```

**Event Data Example:**

```json
{
  "event_type": "mobile_app_notification_action",
  "data": {
    "action": "OPEN_<context_id_here>",
    "reply_text": "Reply from user",
    "action_data": {
      "entity_id": "light.test",
      "my_custom_data": "foo_bar"
    },
    "tag": "TEST"
  },
  "origin": "REMOTE",
  "time_fired": "2020-02-02T04:45:05.550251+00:00",
  "context": {
    "id": "abc123",
    "parent_id": null,
    "user_id": "123abc"
  }
}
```

## Further Considerations

- Use timeouts and unique tags to manage notification lifecycle.
- Listen for `mobile_app_notification_cleared` events to handle notification dismissals (Android).
- Use catch-all automations for common actions (e.g., "SILENCE").
- Migrate from deprecated iOS categories to inline actions.

**Migration Example:**

```yaml
# original
- service: notify.mobile_app_<your_device_id_here>
  data:
    message: "Something happened at home!"
    data:
      push:
        category: "ALARM"
      url:
        _: "/lovelace/cameras"
        ALARM: "/lovelace/alarm"
# replacement
- service: notify.mobile_app_<your_device_id_here>
  data:
    message: "Something happened at home!"
    data:
      url: "/lovelace/cameras"
      actions:
        - action: "ALARM"
          title: "Sound Alarm"
          destructive: true
          uri: "/lovelace/alarm"
        - action: "SILENCE"
          title: "Silence Alarm"
```

For more, see the [Home Assistant actionable notifications documentation](https://companion.home-assistant.io/docs/notifications/actionable-notifications/).

---

## Official Home Assistant Actionable Notification Literature

> The following section is sourced from the official Home Assistant documentation.
> It provides YAML-based examples and detailed explanations for actionable notifications,
> which may be useful for advanced users or those integrating Node-RED with Home Assistant automations directly.

### Actionable Notifications

Actionable notifications are a unique type of notification
as they allow the user to add buttons to the notification which can then send an event to Home Assistant once clicked.
This event can then be used in an automation to perform a wide variety of actions.
These notifications can be sent to either iOS or Android.

Some useful examples of actionable notifications:

- A notification is sent whenever motion is detected in your home while you're away or asleep.
  A "Sound Alarm" action button is displayed alongside the notification, that when tapped, will sound your burglar alarm.
- Someone rings your front doorbell. You receive a notification with a live camera stream of the visitor outside
  along with action buttons to lock or unlock your front door.
- Receive a notification whenever your garage door opens with action buttons to open or close the garage.

Actionable notifications allow the user to send a command back to Home Assistant.

#### iOS

If you have multiple servers connected to an iOS or mac app,
the notification actions will be fired on the server that sent the notification.

#### Version Compatibility

Category-based notifications on iOS and macOS are deprecated.
See the migration guide for more info on converting existing notifications.

#### Apple Watch

Actions on watchOS require the Watch App to be installed. You can install it the system Watch app.

### Building actionable notifications

You can include an actions array in your action.

Android allows 3 notification actions.
iOS allows around 10 notification actions. Any more and the system UI for notification actions begins having scrolling issues.

```yaml
action: notify.mobile_app_<your_device_id_here>
data:
  message: "Something happened at home!"
  data:
    actions:
      - action: "ALARM" # The key you are sending for the event
        title: "Sound Alarm" # The button title
      - action: "URI" # Must be set to URI if you plan to use a URI
        title: "Open Url"
        uri: "https://google.com" # URL to open when action is selected, can also be a lovelace view/dashboard
```

Each action may consist of the following keys:

| Key      | Meaning                                              | Notes                                                                 |
|----------|------------------------------------------------------|-----------------------------------------------------------------------|
| action   | Required. The identifier passed back in events       | When set to REPLY, you will be prompted for text to send with the event. |
| title    | Required. The title of the button shown in the notification |                                                                       |
| uri      | Optional. The URL to open when tapped                | Android requires setting the action to URI to use this key.            |
| behavior | Optional. Set to textInput to prompt for text to return with the event. This also occurs when setting the action to REPLY. | Using this key allows you to use the action key to differentiate actions. |

#### Android specific options

All of the following keys are optional.

_None at this time._

#### iOS specific options

All of the following keys are optional.

| Key                     | Meaning                                               | Notes                                                                 |
|-------------------------|-------------------------------------------------------|-----------------------------------------------------------------------|
| activationMode          | Set to foreground to launch the app when tapped. Defaults to background which just fires the event. | This is automatically set to foreground when providing a uri.         |
| authenticationRequired  | true to require entering a passcode to use the action. |                                                                       |
| destructive             | true to color the action's title red, indicating a destructive action. |                                                                       |
| textInputButtonTitle    | Title to use for text input for actions that prompt.   |                                                                       |
| textInputPlaceholder    | Placeholder to use for text input for actions that prompt. |                                                                       |
| icon                    | The icon to use for the notification.                 | Requires version 2021.10. See notes below.                            |

##### Icon Values

This requires iOS app version 2021.10 or later on iOS 15 or later, or a future version of the macOS app on macOS 12 or later.

Icons for notification actions are only allowed from the SF Symbols library,
which is different than other icons in Home Assistant which come from Material Design Icons library.
This is due to limitations placed on these actions from Apple.

You must prefix the icon name in the catalogue with sfsymbols: (similar to prefixing with mdi: elsewhere),
since we hope to expand this to support MDI in the future. For example:

```yaml
action:
  - action: notify.mobile_app_<your_device_id_here>
    data:
      message: "Something happened at home!"
      data:
        actions:
          - action: "ALARM"
            title: "Sound Alarm"
            icon: "sfsymbols:bell"
          - action: "SILENCE"
            title: "Silence Alarm"
            icon: "sfsymbols:bell.slash"
```

##### uri values

To navigate to a frontend page, use the format `/lovelace/test`
where `test` is replaced by your defined path in the defined view.
If you plan to use a dashboard the format would be `/lovelace-dashboard/view`
where `/lovelace-dashboard/` is replaced by your defined dashboard URL
and `view` is replaced by the defined path within that dashboard. For example:

```yaml
- action: "URI"
  title: "Open Cameras"
  uri: "/lovelace/cameras"
```

Android specific:
If you want to open an application you need to set the action to URI.
The format will be `app://<package>` where `<package>` is replaced by the package you wish to open (ex: `app://com.twitter.android`).
If the device does not have the application installed then the Home Assistant application will open to the default page.

```yaml
- action: "URI"
  title: "Open Twitter"
  uri: "app://com.twitter.android"
```

With action set to URI you can also trigger the More Info panel for any entity.
The format will be `entityId:<entity_ID>` where `<entity_id>` is replaced with the entity ID you wish to view. Ex: `entityId:sun.sun`

```yaml
- action: "URI"
  title: "View the sun"
  uri: "entityId:sun.sun"
```

You can also open the notification history when using the format `settings://notification_history`

```yaml
- action: "URI"
  title: "Notification History"
  uri: "settings://notification_history"
```

Android:
You can also use an intent scheme URI to start an action in an installed application.

```yaml
- action: "URI"
  title: "Intent Scheme"
  uri: "intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;end"
```

You can send a specific deep link to an app
by using `deep-link://<deep_link>` where `<deep_link>` is the actual deep link you wish to send.

For example, to make a telephone call:

```yaml
- action: "URI"
  title: "Call Pizza Hut"
  uri: "deep-link://tel:2125551212"
```

iOS specific:
You can also use application-launching URLs. For example, to make a telephone call:

```yaml
- action: "CALL"
  title: "Call Pizza Hut"
  uri: "tel:2125551212"
```

Or to launch a page in your default browser:

```yaml
- action: "OPEN"
  title: "Open Safari"
  uri: "https://example.com"
```

### Building notification action scripts

There are some important things to keep in mind when building actionable notifications:

- Your script or automation could be run multiple times
- The actions for your notification are shared across all notifications

To avoid issues, you can create unique actions for each time your script is run.
By combining context and variables, this can be fairly straightforward:

```yaml
# inside a automation actions or script sequence
- alias: "Set up variables for the actions"
  variables:
    # Including an id in the action allows us to identify this script run
    # and not accidentally trigger for other notification actions
    action_open: "{{ 'OPEN_' ~ context.id }}"
    action_close: "{{ 'CLOSE_' ~ context.id }}"
- alias: "Ask to close or open the blinds"
  action: notify.mobile_app_<your_device>
  data:
    message: "The blinds are half-open. Do you want to adjust this?"
    data:
      actions:
        - action: "{{ action_open }}"
          title: Open
        - action: "{{ action_close }}"
          title: Close
- alias: "Wait for a response"
  wait_for_trigger:
    - platform: event
      event_type: mobile_app_notification_action
      event_data:
        # waiting for the specific action avoids accidentally continuing
        # for another script/automation's notification action
        action: "{{ action_open }}"
    - platform: event
      event_type: mobile_app_notification_action
      event_data:
        action: "{{ action_close }}"
- alias: "Perform the action"
  choose:
    - conditions: "{{ wait.trigger.event.data.action == action_open }}"
      sequence:
        - action: cover.open_cover
          target:
            entity_id: cover.some_cover
    - conditions: "{{ wait.trigger.event.data.action == action_close }}"
      sequence:
        - action: cover.close_cover
          target:
            entity_id: cover.some_cover
```

The above sends a notification, waits for a response, and then performs whichever action is being requested.

When the notification action is performed, the `mobile_app_notification_action` event fires with the following data:

```json
{
    "event_type": "mobile_app_notification_action",
    "data": {
        "action": "OPEN_<context_id_here>",
        // will be present:
        // - when `REPLY` is used as the action identifier
        // - when `behavior` is set to `textInput`
        "reply_text": "Reply from user",
        // iOS-only, will be included if sent in the notification
        "action_data": {
          "entity_id": "light.test",
          "my_custom_data": "foo_bar"
        },
        // Android users can also expect to see all data fields sent with the notification in this response such as the "tag"
        "tag": "TEST"
    },
    "origin": "REMOTE",
    "time_fired": "2020-02-02T04:45:05.550251+00:00",
    "context": {
        "id": "abc123",
        "parent_id": null,
        "user_id": "123abc"
    }
}
```

### Further Considerations (Official Home Assistant Literature)

#### Blocking Behaviour

The above example will wait, until the notification action is performed.
This might lead to unexpected behaviour, depending on the automation mode of the script.
For "single" mode, this will lead to a situation,
where the script is not executed again if the previous notification action has not yet been performed.
For "queue" and "parallel" this will happen if a certain number of notifications have not yet been performed.
For "restart" mode it means,
that as soon as the script is triggered again
notification actions of the older instances of the script will not fire the corresponding action.
Depending on the use case, there are several options:

- You can use a time out to allow new executions of the script.
  However, this will lead to dangling notifications on your mobile phone.
- It is possible to clear notifications which can be combined with timeouts and parallel execution mode to achieve good results.
- In Android you can listen to the notification cleared event that is fired when the notification is closed,
  and handle it accordingly. This can be achieved by adding the following lines:

```yaml
  - platform: event
    event_type: mobile_app_notification_cleared
    event_data:
      action_1_key: '{{ action_open }}'
```

and

```yaml
    - conditions: "{{ wait.trigger.event.event_type == 'mobile_app_notification_cleared' }}"
      sequence:
          - action: persistent_notification.create
            data:
              title: App notification result
              message: The notification was closed
```

Keep in mind that the event will not be fired when the Home Assistant app crashes or is closed,
so a timeout should still be considered.

#### Catch All Triggers

You can also create automations that trigger for any notification action.
For example, if you wanted to include a SILENCE action on a variety of notifications, but only handle it in one place:

```yaml
automation:
  - alias: "Silence the alarm"
    trigger:
      - platform: event
        event_type: mobile_app_notification_action
        event_data:
          action: "SILENCE"
    action:
      ...
```

#### Migrating from Categories

Starting in iOS version 2021.5, actions are specified inline with notifications. To migrate, do the following:

Add the actions array to each notification. For example:

```yaml
# original
action:
  - action: notify.mobile_app_<your_device_id_here>
    data:
      message: "Something happened at home!"
      data:
        push:
          category: "ALARM"
        url:
          _: "/lovelace/cameras" # if the notification itself is tapped
          ALARM: "/lovelace/alarm" # if the 'ALARM' action is tapped
# replacement
action:
  - action: notify.mobile_app_<your_device_id_here>
    data:
      message: "Something happened at home!"
      data:
        url: "/lovelace/cameras" # launched if no action is chosen
        actions:
          # for compatibility, the YAML definition of actions can be used
          # for example, you may use `identifier` instead of `action`
          - action: "ALARM"
            title: "Sound Alarm"
            destructive: true
            uri: "/lovelace/alarm"
          - action: "SILENCE"
            title: "Silence Alarm"
```

Convert your event triggers to the new values:

```yaml
# original
automation:
  - alias: "Sound the alarm iOS"
    trigger:
      - platform: event
        event_type: ios.notification_action_fired
        event_data:
          actionName: "ALARM"
    action:
      ...
# replacement
automation:
  - alias: "Sound the alarm iOS"
    trigger:
      - platform: event
        event_type: mobile_app_notification_action
        event_data:
          action: "ALARM"
    action:
      ...
```

The above is the minimum necessary to migrate.
You can also rewrite your automations to use wait_for_trigger like previous examples,
though this is more work and not strictly necessary.

### Compatibility with different devices

#### iOS 13 and later

All devices support notification expanding by performing a right to left swipe and pressing 'View' in the lock screen
or pressing and holding,
but on 3D Touch-enabled devices you may still need to apply some force to do it.
If you're not in the lock screen, you can also pull the notification down to expand it.

---
