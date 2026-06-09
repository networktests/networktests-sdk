# Changelog

All notable changes to `@networkdiagnostics/sdk` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-pre.4] — 2026-06-09

### Fixed
- Pass `--tag next` for pre-release versions in release workflow.
  npm >= 11 refuses to publish pre-release versions without an
  explicit dist-tag so they don't pollute `latest`. Stable versions
  (no hyphen) continue to publish to `latest`.

## [0.1.0-pre.3] — 2026-06-09

### Fixed
- Upgrade npm to latest in the release workflow. Trusted Publishing
  requires npm ≥ 11.5.1; setup-node@v4 with Node 20 ships npm 10.x
  which silently falls back to anonymous auth and returns 404 on PUT.

## [0.1.0-pre.2] — 2026-06-09

### Changed
- Switched release workflow from NPM_TOKEN to npm Trusted Publishing (OIDC).
  Auth is now performed via the GitHub Actions OIDC token at publish time;
  no long-lived token in CI secrets.

## [0.1.0-pre.1] — 2026-06-09

First test publish to verify the end-to-end pipeline.

## [Unreleased]

### Added
- Initial scaffolding: package skeleton, TypeScript build via tsup, vitest test runner.
- `NetworkTests` class with `runUdpTest()` and `runDnsLeakTest()` methods.
- UDP throughput probe: WebSocket signaling, RTCPeerConnection + DataChannel orchestration,
  client-side ack loop, server-authoritative result delivery via `test-complete` message.
- DNS leak probe: parallel FQDN trigger via `Image()` (primary) and `fetch(no-cors)` (fallback).
- React adapters: `useUdpTest`, `useDnsLeakTest` hooks under `@networkdiagnostics/sdk/react`.
- Error hierarchy: `NetworkTestsError`, `AbortError`, `TimeoutError`.
- Unit tests for signaling type guard, error classes, and DNS trigger.
