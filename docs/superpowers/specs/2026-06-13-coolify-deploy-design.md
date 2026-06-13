# Coolify Deploy + Slack Bot Migration — Design Spec

**Date:** 2026-06-13
**Status:** Approved (pending implementation)

## Summary

Deploy `slack-meme-poster` to the homelab **Coolify** instance (apps-01,
`10.0.20.30`) as a domain-less cron worker, in two tiers from one codebase:

| Tier | Branch | Slack workspace | Memes folder                                  |
|------|--------|-----------------|-----------------------------------------------|
| prod | `main` | itenium         | `…/Archive/Funny/Programming`                 |
| dev  | `dev`  | pongit          | `…/Archive/Funny/Programming_dev-test`        |

To make this clean on Coolify, the app first **migrates off the Slack incoming
webhook to a Slack bot** (`files.uploadV2`): the bot uploads the image file
directly, so the public `static-file-server` (and `HOST_URL`) are retired. With
no public file to serve, the container has no HTTP port and no domain — it just
runs `crond`.

Memes stay on `nas-work`. apps-01 NFS-mounts the **whole Dropbox root** at
`/mnt/dropbox`; each app binds only the subpath it needs (this app:
`${MEMES_HOST_DIR}:/memes`), so prod and dev point at different folders with **no
branch divergence** — the difference is per-resource env in Coolify.

Deployment is **config-as-code** via the Home repo's `coolify-apps.ts` manifest +
`bun sync.ts`. Two small manifest-tooling extensions are needed (domain-less
apps; per-org GitHub App). The irreducible one-time manual steps (Synology NFS
export, Coolify GitHub App install on `itenium-be`, Slack bot creation) are
documented, not scripted.

This spec spans two repos. App-side changes land here
(`itenium-be/slack-meme-poster`); infra/tooling changes land in the **Home** repo
(`homelab/coolify`, `homelab/docs/runbooks/11-coolify.md`) and are described in
§Infra and §Tooling for cross-reference.

## Scope

**In scope**

- **App — Slack bot migration**
  - `job/post-slack.js`: replace the webhook `fetch` with `@slack/web-api`
    (`WebClient.files.uploadV2`). New signature `postSlackMeme(filePath, meta?)`
    — uploads a local file to `SLACK_CHANNEL_ID` with the existing header (and
    optional title-link) as `initial_comment`. The pure block helpers
    (`pickHeader`, `escapeMrkdwn`, `buildMemeBlocks`) stay; the message-shape
    decision (Block Kit image block vs `initial_comment`) is settled in
    §Open-design-points.
  - `job/meme-poster.js`: pass the moved file's local path to `postSlackMeme`;
    drop the `HOST_URL` URL building.
  - `reddit-job/index.js`: pass the downloaded file's local path to
    `postSlackMeme` (keeps the shared module coherent — see Reddit note below).
    Drop the `HOST_URL` requirement.
  - `docker-compose.yaml`: delete the `file_server` service. One `cron_job`
    service with `volumes: ["${MEMES_HOST_DIR}:/memes"]` and env
    `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `MEMES_HOST_DIR`, `POST_CRON`, `TZ`
    (Reddit env present but unset — see below).
  - `.env.sample`: add `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `MEMES_HOST_DIR`;
    remove `HOST_URL`, `FILE_SERVER_PORT`, `SLACK_WEBHOOK`.
  - `package.json` (both jobs as needed): add `@slack/web-api`.
  - TDD for the pure/refactored bits (block building, upload-arg shaping).
  - Create the `dev` branch off `main` once `main` is migrated.

- **Infra — apps-01 NFS mount** (Home repo / runbook §)
  - apps-01 `/etc/fstab`: `10.0.20.10:/volume1/Dropbox /mnt/dropbox nfs …`.
  - Documented in `homelab/docs/runbooks/11-coolify.md`.

- **Tooling — manifest extensions** (Home repo `homelab/coolify`, TDD)
  - `AppSpec.domain` → optional. `plan.ts` omits domain/ports/compose-domain
    when absent (domain-less worker); the dev tier is the `dev` branch with **no**
    `dev-` domain prefix.
  - `target.ts`: an **org → githubAppUuid** registry; `createPayload` derives
    `github_app_uuid` from the repo's org prefix
    (`SanguPackage` → existing app, `itenium-be` → the new one).
  - New manifest entry:
    `{ repo: "itenium-be/slack-meme-poster", dev: true,
       build: { pack: "dockercompose", service: "cron_job",
                composeLocation: "/docker-compose.yaml" } }`
    — no `domain`, no `auth` (no route to gate).

**Out of scope (deferred)**

- **Reddit job** — stays in the codebase and is migrated to the bot (shared
  module), but is **not enabled** this round: `REDDIT_SUBREDDIT` is left unset, so
  `start.sh` does not schedule it. Only the weekly Friday meme cron runs.
- Video / `v.redd.it` handling (tracked in `ImproveMemePoster.md`).
- `already-sent/from-reddit/` subfolder (tracked in `ImproveMemePoster.md`).
- SOPS / secret-in-git: secrets are set per-resource in the Coolify UI, never in
  the manifest (matches the Home repo's "manifest = infra/placement only" rule).
- PR previews for this app (worker, no domain to preview).

## Architecture

```
  Dropbox (nas-work 10.0.20.10) ──NFS──▶ apps-01 /mnt/dropbox
                                              │ bind ${MEMES_HOST_DIR}:/memes
                                              ▼
   Coolify (apps-01) ── dockercompose ──▶ cron_job container (crond)
        ▲                                     │ files.uploadV2 (@slack/web-api)
        │ github_app(itenium-be) webhook      ▼
   push main/dev  ────────────────▶     Slack (itenium / pongit)
```

- **prod** = `main` branch resource → itenium bot/channel, real memes folder.
- **dev** = `dev` branch resource → pongit bot/channel, `_dev-test` folder,
  `POST_CRON` set very infrequent (≈ yearly); use `POST_MEME_ON_STARTUP` to test
  on deploy.
- No domain, no exposed port: Coolify runs the compose; the container's job is
  `crond -f`.

## Components & data flow

1. **Manifest** (`coolify-apps.ts`, Home) declares the app: repo, `dev: true`,
   dockercompose build pack. `sync.ts` creates/updates the prod + dev resources,
   deriving the GitHub App from the `itenium-be` org and deploying.
2. **Secrets/env** are set **per resource** in the Coolify UI:
   `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `MEMES_HOST_DIR`, `POST_CRON`, `TZ`.
3. **Compose** (in the app repo) binds `${MEMES_HOST_DIR}:/memes` from the host
   NFS mount and runs the cron container.
4. **Job** picks a random meme, moves it to `/memes/already-sent/`, and uploads
   it to Slack via the bot. No public URL anywhere in the path.

## Error handling

- Missing `SLACK_BOT_TOKEN`/`SLACK_CHANNEL_ID`: fail fast with a clear message
  (same posture as the current `HOST_URL` guard).
- `files.uploadV2` returns `ok: false`: throw with the Slack error code; the cron
  run exits non-zero (visible in Coolify logs).
- NFS unavailable at container start: the bind mount is empty → the job finds no
  memes and logs/exits; no silent success.

## Testing

- TDD per the repo norm (`bun test`): pure block building, the upload-argument
  shaping (file path + initial_comment + channel), and the manifest `plan.ts`
  changes (domain-less payload/diff; org→githubApp derivation) in the Home repo's
  `plan.test.ts`.
- Manual verification: deploy dev with `POST_MEME_ON_STARTUP=1`, confirm a meme
  lands in the pongit channel and the file moved to `already-sent/`.

## One-time manual steps (documented, not scripted)

| Step                                                        | Where                  |
|-------------------------------------------------------------|------------------------|
| NFS-export `/volume1/Dropbox` → apps-01 `10.0.20.30` (rw)   | Synology `nas-work` UI |
| `/mnt/dropbox` fstab mount                                  | apps-01 host           |
| Create the `Programming_dev-test` folder                    | Dropbox                |
| Create + install Coolify GitHub App on `itenium-be`; record its uuid in `target.ts` | GitHub + Coolify UI |
| Create 2 Slack bots (itenium + pongit), per `CreateSlackBot.md` | Slack |
| Set per-resource env (tokens, channel IDs, `MEMES_HOST_DIR`, `POST_CRON`) | Coolify UI |

After this: push to `main`/`dev` auto-deploys; drop memes in the Dropbox folder.

## Open design points (decide during implementation)

1. **Bot message shape.** `files.uploadV2` supports an `initial_comment`
   (mrkdwn) attached to the uploaded file — simplest, and renders the header +
   optional title link above the image. The current Block Kit `image` block uses
   a public `image_url`, which the bot path no longer has. **Lean:**
   `initial_comment` + uploaded file; keep `pickHeader`/`escapeMrkdwn`, retire
   `buildMemeBlocks`' image block (or keep it only for the header/title section).
   Verify against Block Kit during implementation.
2. **Channel config.** One `SLACK_CHANNEL_ID` per resource (prod=itenium,
   dev=pongit). No separate Reddit channel (Reddit disabled this round).
