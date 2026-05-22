# AI Meme Job — Design Spec

**Date:** 2026-05-22
**Status:** Approved (pending implementation)

## Summary

Add a second, independent cron job to `slack-meme-poster` that sources a meme
from Reddit instead of the manually curated `memes/` folder.

Each run:

1. Looks at posts in a configured subreddit since the previous scheduled run.
2. Picks the still-image post with the most upvotes.
3. Downloads it as `YYYY-MM-DD.<ext>` into `memes/already-sent/`.
4. Posts it to Slack via the existing webhook poster.

The job is **opt-in** (gated on an env var), **stateless** (the window is
derived from the cron expression), and reuses the existing posting path.

## Scope

**In scope**

- New `ai-job/` Node ESM module (sibling to `job/`).
- Direct still images only: `.jpg`, `.jpeg`, `.png`, `.gif`.
- Public Reddit JSON endpoint (no OAuth).
- Posting via the existing `job/post-slack.js` (webhook image block).
- New env vars + cron wiring in `start.sh`, `Dockerfile`, `docker-compose.yaml`,
  `.env.sample`.

**Out of scope (deferred)**

- Video (`v.redd.it`) — requires the separate Slack bot-token migration
  (`files.uploadV2`) plus ffmpeg muxing. Tracked in README TODO.
- Galleries (`is_gallery`).
- External/imgur link resolution.
- Reddit OAuth.

## Architecture

Approach: a new sibling `ai-job/` module that reuses the existing webhook
posting. Pure selection/scheduling logic is isolated from IO so it is unit
testable.

```
ai-job/
  index.js        # orchestrator (IO: ties everything together)
  reddit.js       # fetchTopPosts(subreddit, window)            (IO)
  select.js       # pickMeme(posts, sinceUtc) -> winner | null  (PURE)
  schedule.js     # previousRun(cron, now), redditWindow(...)    (PURE)
  select.test.js  # bun tests for the pure logic
  schedule.test.js
  package.json    # deps: node-fetch, cron-parser
job/
  post-slack.js   # REUSED as-is, imported by ai-job/index.js   (unchanged)
  meme-poster.js  # unchanged
```

`job/post-slack.js` stays unchanged and gains a second caller. No change to
`meme-poster.js` is needed: the downloaded image lands only in
`memes/already-sent/`, which the random poster already skips.

### Components

| Module        | Responsibility                                                                                          | Depends on            |
|---------------|---------------------------------------------------------------------------------------------------------|-----------------------|
| `reddit.js`   | `fetchTopPosts(subreddit, window)` -> normalized post array. Sets a descriptive `User-Agent`.           | node-fetch            |
| `select.js`   | **Pure.** Filter to still-images, drop NSFW/video, keep `created_utc > sinceUtc`, return highest-score post or `null`. | nothing |
| `schedule.js` | **Pure.** `previousRun(cronExpr, now)` -> previous fire `Date`; `redditWindow(sinceUtc, now)` -> reddit `t` param. | cron-parser |
| `index.js`    | Orchestrates one run; reuses `../job/post-slack.js`.                                                     | all of the above      |

A "normalized post" is `{ id, title, score, url, createdUtc, postHint, isVideo, over18 }`.

## Data flow (one run)

1. `sinceUtc = previousRun(AI_POST_CRON, now)`. If the cron cannot be parsed or
   yields no prior occurrence, fall back to `now - 7 days`.
2. `window = redditWindow(sinceUtc, now)` -> reddit `t` value
   (`hour` / `day` / `week` / `month` / `year`) covering the gap.
3. `fetchTopPosts(AI_SUBREDDIT, window)` against
   `https://www.reddit.com/r/<sub>/top.json?t=<window>&limit=100`.
   On non-200 or network error: log and `exit 1` (no post; cron retries).
4. `pickMeme(posts, sinceUtc)`:
   - keep posts where `postHint === 'image'` **or** `url` matches
     `/\.(jpe?g|png|gif)$/i`,
   - drop `over18` and `isVideo`,
   - keep `createdUtc > sinceUtc`,
   - return the highest-`score` post, or `null` if none qualify.
5. If `null`: log "nothing new", `exit 0`.
6. Download the winner's image. `ext` from the URL.
   `filename = <YYYY-MM-DD>.<ext>` using the run date.
   If that file already exists in `already-sent`, append `-2`, `-3`, ... .
7. Write the image to `memes/already-sent/<filename>` only.
8. `postSlackMeme(HOST_URL + 'already-sent/' + filename)`. `exit 0`.

The window is disjoint between consecutive runs (`(previousFire, now]`), so a
meme is never reposted; no dedup state is required.

## "Since the last run" without state

`AI_POST_CRON` defines the cadence. `previousRun` uses `cron-parser` to compute
the scheduled occurrence immediately **before** the current run, which is when
the job last fired. That timestamp is the `sinceUtc` cutoff.

Known trade-off: a post created just before a run with a low score, that becomes
popular only afterwards, falls outside the next run's window and can never win.
This is inherent to "since last run" semantics and is accepted.

## Configuration

New env vars, passed to the `cron_job` service in `docker-compose.yaml` and
documented in `.env.sample`:

| Var                  | Purpose                                          | If unset                  |
|----------------------|--------------------------------------------------|---------------------------|
| `AI_SUBREDDIT`       | Subreddit to scrape (e.g. `ProgrammerHumor`).    | **ai-job not scheduled**  |
| `AI_POST_CRON`       | Cron schedule for the ai-job.                    | ai-job not scheduled      |
| `AI_POST_ON_STARTUP` | Run once at container start (like `POST_MEME_ON_STARTUP`). | skip startup run |

`.env.sample` uses `AI_SUBREDDIT=ProgrammerHumor` as the example (the large
active sub; the originally linked `r/programminghumor` is a small alt).

### `start.sh`

Currently writes a single crontab line. Change to:

1. `cd ai-job && npm install` (alongside the existing `job` install).
2. If `AI_POST_ON_STARTUP` is set, run `node /usr/scheduler/ai-job/index.js`
   once.
3. Build `crontab.txt` with the existing `POST_CRON` line, and **append** the
   `AI_POST_CRON` line only if `AI_SUBREDDIT` is set:
   `${AI_POST_CRON} node /usr/scheduler/ai-job/index.js`.

### `Dockerfile`

Add `COPY ai-job/*.* ./ai-job/` and include `ai-job/*.*` in the `dos2unix` step.

### Reddit User-Agent

Reddit requires a descriptive `User-Agent`. Hardcode a sensible default
(e.g. `slack-meme-poster/1.0`). Can be promoted to an env var later if the NAS
IP gets rate-limited/blocked (the accepted risk of the public JSON endpoint).

## Error handling

| Situation                          | Behavior                                  |
|------------------------------------|-------------------------------------------|
| Reddit non-200 / network error     | Log, `exit 1`, nothing posted.            |
| No qualifying post in window        | Log "nothing new", `exit 0`.              |
| Image download fails                | Log, `exit 1`, nothing posted.            |
| Slack post                          | Fire-and-forget, unchanged from existing. |

Cron simply runs again on the next fire; no retry/backoff logic is added.

## Testing

Per project TDD: unit tests with `bun test` cover the pure modules. The runtime
in the container stays node:16; bun is used for the dev/test toolchain only.

- `select.test.js` — `pickMeme`:
  - picks the highest-score qualifying image,
  - skips NSFW (`over18`), video (`isVideo`), and non-image posts,
  - excludes posts with `createdUtc <= sinceUtc`,
  - returns `null` when nothing qualifies.
- `schedule.test.js`:
  - `previousRun` returns the prior scheduled occurrence for a known cron,
  - falls back to `now - 7d` on unparseable input,
  - `redditWindow` maps gap sizes to the correct `t` value.

IO modules (`reddit.js`, image download, posting) are kept thin and are not unit
tested.

## Out-of-scope follow-ups

- Video support via Slack bot token + `files.uploadV2` + ffmpeg (existing README TODO).
- Promote the Reddit `User-Agent` to an env var if the public endpoint gets blocked.
