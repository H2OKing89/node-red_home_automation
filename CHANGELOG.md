# Changelog

All notable changes to this Node-RED Home Automation project will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Unreleased)

- Complete README overhaul with ToC, badges, examples, and troubleshooting
- Mermaid architecture diagrams
- Comprehensive installation and configuration guides
- Global context configuration examples
- Sample payloads for weather alerts, alarm states, and notifications
- Contributing guidelines and development setup instructions

### Changed

- Enhanced documentation structure with collapsible sections
- Improved project organization and directory explanations
- Updated requirements with specific Node-RED palettes and modules
- Modernized README with HTML enhancements and better formatting

## [1.7.0] - 2025-08-26

### Added (1.7.0)

- **NEW FLOW:** Intelligent Wake-Up Alarm Clock TTS Scheduler (`alarm_clock_flow/`)
  - Advanced cron-based alarm scheduling with cronplus node integration
  - Multi-variation TTS announcements (5 different wake-up messages) to prevent monotony
  - Timezone-aware time formatting with `date-fns-tz` integration and graceful fallbacks
  - Sonos speaker integration via Home Assistant media_player service
  - Environment-driven configuration system with JSON support
  - Comprehensive alarm history tracking and analytics (last 10 alarms)
  - Professional error handling with graceful degradation
  - Configurable volume control and entity management
- Comprehensive SunCalc solar intelligence documentation (`docs/modules/suncalc_enhanced.md`)
  - Advanced daylight detection algorithms and solar positioning calculations
  - Multi-zone intelligent lighting automation examples
  - Complete solar phase system with dawn/dusk detection
  - Testing framework for solar calculations and coordinate validation
  - Professional automation examples for garage lighting and smart home integration

### Enhanced (1.7.0)

- Alarm clock scheduler with robust module dependency handling
  - Automatic detection of `date-fns-tz` availability with fallback behavior
  - Consistent error handling patterns across all alarm processing functions
  - URL encoding optimization for TTS message compatibility

### Security (1.7.0)

- Privacy protection in documentation examples
  - Replaced real GPS coordinates with generic example locations (New York City)
  - Enhanced coordinate validation examples with fictional test data

### Technical Improvements (1.7.0)

- Environment variable configuration with nested JSON structure support
- Advanced TTS message rotation system based on alarm count
- Professional logging with emoji-enhanced status indicators
- Comprehensive debugging data output for troubleshooting
- Context-based alarm counter and history management

### Files Added

- `alarm_clock_flow/wake_alarm_clock_scheduler.js` - Core TTS scheduler implementation
- `alarm_clock_flow/README.md` - Complete documentation with HTML styling and setup guides
- `alarm_clock_flow/.env` - Environment configuration template
- `docs/modules/suncalc_enhanced.md` - Solar intelligence integration guide

## [1.6.0] - 2025-08-25

### Changed (1.6.0)

- **BREAKING:** Transitioned alarm notification system from hardcoded messages to environment variables
- Migrated all notification files from `global.get()` to `env.get()` for configuration retrieval
- Updated notification message construction to use environment variable values instead of hardcoded strings
- Added proper JSON parsing for environment variables stored as strings

### Added (1.6.0)

- Environment variable support for notification maps (`NOTIFY_MAP_ANDROID`, `NOTIFY_MAP_IOS`)
- Configurable alarm messages via environment variables:
  - `ALARM_DISABLED_PUSH` - Message when alarm is disabled
  - `ALARM_PENDING_PUSH` - Message when alarm is pending/armed  
  - `ALARM_TRIGGERED_PUSH` - Message when alarm is triggered
  - `ALARM_DISABLED_TTS` - TTS message when alarm is disabled
  - `ALARM_PENDING_TTS` - TTS message when alarm is pending
  - `ALARM_TRIGGERED_TTS` - TTS message when alarm is triggered
- Environment variable configuration file template (`.env`)

### Fixed (1.6.0)

- Notification files now properly use retrieved environment variable values instead of ignoring them
- Corrected HTML formatting in push notifications with proper `\\u200B` prefix for color display
- Fixed Buffer usage for image attachment encoding in NFC tag notifications
- Updated TTS notifications to use environment variables instead of hardcoded messages

### Improved (1.6.0)

- Centralized message management through environment variables
- Consistency across all notification files
- Better separation of configuration from code
- Environment-specific configuration support (dev/staging/production)

### Files Updated

- `alarm_flow/alarm_state_group/notify/disabled_push_mobile.js`
- `alarm_flow/alarm_state_group/notify/pending_push_mobile.js`
- `alarm_flow/alarm_state_group/notify/triggered_push_mobile.js`
- `alarm_flow/alarm_state_group/notify/disabled_tts_mobile.js`
- `alarm_flow/alarm_state_group/notify/pending_tts_mobile.js`
- `alarm_flow/alarm_state_group/notify/triggered_tts_mobile.js`
- `nfc_tags_flow/tag_notify_pushover.js`

## [1.5.3] - 2025-06-03

### Improved

- Replaced `node.info()` with `node.log()` in weather priority alerts  
  to match Function node API

### Fixed

- Resolved TypeScript errors in flow context get/set operations

## [1.5.2] - 2025-05-30

### Additions

- Comprehensive debug logs for tracing inputs, outputs, and state changes  
  in weather alerts
- TTL-based duplicate handling for weather alerts

### Enhanced

- Weather alert processing with multiple alert support per message
- Granular error handling for malformed alerts

## [1.5.1] - 2025-05-15

### Bug Fixes

- Extra arguments removed from flow.get and flow.set calls
- Type validation improvements for weather alert processing

## [1.5.0] - 2025-04-01

### New Features

- Type validation for weather alert payloads
- Multiple alert processing in single message support
- TTL-based duplicate alert filtering with automatic expiration
- Enhanced error handling with per-alert validation

### Improvements

- Alert history management with configurable TTL and max storage limits

## [1.3.1] - 2024-09-02

### New Additions

- Full names to knownUsers list in alarm handler
- Google Home/Nest speaker support alongside Sonos for TTS announcements

### Resolved Issues

- Null checking for outputs array before accessing outputs[1]
- Global context documentation and usage examples

### Enhancements

- Multi-speaker TTS configuration with separate volume controls
- Pushover integration with comprehensive error handling

## [1.0.0] - 2024-06-01

### Initial Release

- Complete Node-RED Home Automation suite
- Alarm system with state management and duress code support
- Garage automation with motion-activated lighting
- Weather alert processing with priority scoring
- Unified notification system (Pushover, Gotify, TTS)
- NFC tag processing and routing
- Jellyseerr webhook integration
- Comprehensive documentation for all flows

### Core Features

- Home Assistant WebSocket integration
- SunCalc integration for lighting automation
- date-fns/date-fns-tz for timezone-aware formatting  
- Global context configuration management
- Per-flow documentation and examples
