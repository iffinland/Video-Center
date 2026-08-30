# Video Center

Video Center is a Qortium-native decentralized video-sharing dApp. Current
flows include video discovery/playback, channels, following, publishing,
comments/reactions, and selected-account behavior inside Qortium Home.

## QDN application identity

The current manifest declares `APP/Video_Center/video-center`. Its repository
and homepage fields still point to `QortiumDev/video-center`, while this checkout
uses `iffinland/Video-Center`. That provenance mismatch must be resolved as an
owner/release decision before a release; it is not changed silently here.

## Development

```bash
npm ci
npm run dev
npm run typecheck
npm run test
npm run build
npm run lint
npm run format:check
```

The architecture suites are automated evidence only. Video/media retrieval,
selected account, publishing approval, payments, direct routes, and display
behavior require embedded Home and applicable live QDN validation.

## Documentation and agent routing

- [`AGENTS.md`](AGENTS.md) — project entry point for AI-assisted work.
- [`qortium-app.json`](qortium-app.json) — current application/QAVS manifest.
- [`docs/RELEASE.md`](docs/RELEASE.md) — release and deployment gates.
- Canonical project context:
  `/home/iffi/VsCodec-Projects/Qortium/qortium-dev-workspace/projects/video-center.md`

AI work reports belong under
`/home/iffi/VsCodec-Projects/Qortium/docs/video-center/`, not this repository's
`docs/` directory.

## Release boundary

Manifest permissions do not authorize an agent to publish or send coins. Build,
commit, push, tag, release, deployment, signing, transactions, and QDN
publication require explicit owner authorization.
