# Changelog

All notable changes to `@networktests/sdk` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial scaffolding: package skeleton, TypeScript build via tsup, vitest test runner.
- `NetworkTests` class with `runUdpTest()` and `runDnsLeakTest()` methods.
- UDP throughput probe: WebSocket signaling, RTCPeerConnection + DataChannel orchestration,
  client-side ack loop, server-authoritative result delivery via `test-complete` message.
- DNS leak probe: parallel FQDN trigger via `Image()` (primary) and `fetch(no-cors)` (fallback).
- React adapters: `useUdpTest`, `useDnsLeakTest` hooks under `@networktests/sdk/react`.
- Error hierarchy: `NetworkTestsError`, `AbortError`, `TimeoutError`.
- Unit tests for signaling type guard, error classes, and DNS trigger.
