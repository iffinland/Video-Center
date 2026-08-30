# Video Center Release and Deployment Runbook

## Current blocker

`qortium-app.json` declares `APP/Video_Center/video-center`, but its
repository/homepage fields point to `QortiumDev/video-center` while the actual
remote is `iffinland/Video-Center`. The owner must approve the intended
provenance before release metadata is changed or published.

## Required authority

Manifest permissions and a build do not authorize publication or `SEND_COIN`.
Commit, push, tag, release, signing, payments, deployment, and QDN publication
require explicit owner authorization.

## Pre-release gates

1. Record Git/remote/working-tree baseline and preserve owner work.
2. Resolve manifest provenance and verify APP identity, version, permissions,
   license, entry point, and minimum Home behavior against current source.
3. Run:

   ```bash
   npm ci
   npm run typecheck
   npm run test
   npm run build
   npm run lint
   npm run format:check
   git diff --check
   ```

4. Inspect `dist/`, relative routing/assets, and unintended files.
5. Record exact source commit and artifact SHA-256. The repository does not
   currently define a canonical publication command.

## Deployment validation

Use an owner-approved Home/QDN publication flow and record the resulting
transaction/resource reference. Validate the exact deployed app in Home:
startup, `_qdnBase` and direct routes, playback/media, channel identity,
following, comments/reactions, selected account, publication approval/readback,
display settings, and payment approval where in authorized scope.

Do not substitute mocked architecture tests or local preview for live evidence.
