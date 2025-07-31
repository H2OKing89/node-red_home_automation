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
