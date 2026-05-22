# AI Meme Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, stateless cron job that posts the top-upvoted still-image from a subreddit (since the previous run) to Slack, reusing the existing webhook poster.

**Architecture:** New `ai-job/` Node ESM module (sibling to `job/`). Pure logic (`select.js`, `schedule.js`) is isolated from IO (`reddit.js`, `index.js`) so it is unit-testable. The run window is derived from the cron expression via `cron-parser` (no persisted state). The downloaded image lands in `memes/already-sent/` (served by the existing static-file-server) and is posted with the unchanged `job/post-slack.js`.

**Tech Stack:** Node 20 (container), Bun (dev/test only), `node-fetch@3`, `cron-parser@5`. Reddit public JSON endpoint.

---

## File Structure

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `ai-job/package.json`     | Module manifest; deps `node-fetch@3`, `cron-parser@5`. | Create |
| `ai-job/select.js`        | **Pure.** `isImagePost(post)`, `pickMeme(posts, sinceUtc)`. | Create |
| `ai-job/schedule.js`      | **Pure.** `previousRun(cronExpr, now, tz)`, `redditWindow(sinceUtc, now)`. | Create |
| `ai-job/reddit.js`        | IO. `fetchTopPosts(subreddit, window)` → normalized posts. | Create |
| `ai-job/index.js`         | IO orchestrator; reuses `../job/post-slack.js`. | Create |
| `ai-job/select.test.js`   | Bun tests for `select.js`. | Create |
| `ai-job/schedule.test.js` | Bun tests for `schedule.js`. | Create |
| `Dockerfile`              | Bump base to node:20-alpine; copy + dos2unix `ai-job/`. | Modify |
| `start.sh`                | Install ai-job deps; optional startup run; conditional crontab line. | Modify |
| `docker-compose.yaml`     | Pass `AI_*` env to `cron_job`. | Modify |
| `.env.sample`             | Document `AI_*` vars. | Modify |

**Normalized post shape** (produced by `reddit.js`, consumed by `select.js`):
```js
{ id, title, score, url, createdUtc, postHint, isVideo, over18 }
```
`createdUtc` is Reddit's `created_utc` (epoch **seconds**).

---

## Task 1: Pure selection logic (`select.js`)

**Files:**
- Create: `ai-job/select.js`
- Test: `ai-job/select.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// ai-job/select.test.js
import { test, expect } from 'bun:test'
import { isImagePost, pickMeme } from './select.js'

const SINCE = new Date('2026-05-15T00:00:00Z') // epoch s = 1747267200
const after = 1747353600  // 2026-05-16
const before = 1747180800 // 2026-05-14

const img = (over) => ({ id: 'a', title: 't', score: 10, url: 'https://i.redd.it/a.jpg', createdUtc: after, postHint: 'image', isVideo: false, over18: false, ...over })

test('isImagePost: true for image post_hint', () => {
  expect(isImagePost(img())).toBe(true)
})

test('isImagePost: true when url ends in image extension', () => {
  expect(isImagePost(img({ postHint: undefined, url: 'https://x/y.PNG' }))).toBe(true)
})

test('isImagePost: false for video', () => {
  expect(isImagePost(img({ isVideo: true }))).toBe(false)
})

test('isImagePost: false for nsfw', () => {
  expect(isImagePost(img({ over18: true }))).toBe(false)
})

test('isImagePost: false for non-image link', () => {
  expect(isImagePost(img({ postHint: 'link', url: 'https://example.com/page' }))).toBe(false)
})

test('pickMeme: returns highest score among eligible images', () => {
  const posts = [
    img({ id: 'low', score: 5 }),
    img({ id: 'high', score: 99 }),
    img({ id: 'vid', score: 500, isVideo: true }),
  ]
  expect(pickMeme(posts, SINCE).id).toBe('high')
})

test('pickMeme: excludes posts created on/before sinceUtc', () => {
  const posts = [img({ id: 'old', score: 99, createdUtc: before })]
  expect(pickMeme(posts, SINCE)).toBe(null)
})

test('pickMeme: returns null when nothing qualifies', () => {
  expect(pickMeme([img({ isVideo: true })], SINCE)).toBe(null)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ai-job && bun test select.test.js`
Expected: FAIL — `Cannot find module './select.js'` (or export not found).

- [ ] **Step 3: Write minimal implementation**

```js
// ai-job/select.js
const IMAGE_RE = /\.(jpe?g|png|gif)$/i

export function isImagePost(post) {
  const isImage = post.postHint === 'image' || IMAGE_RE.test(post.url)
  return isImage && !post.isVideo && !post.over18
}

export function pickMeme(posts, sinceUtc) {
  const sinceSeconds = sinceUtc.getTime() / 1000
  const eligible = posts.filter(
    (p) => isImagePost(p) && p.createdUtc > sinceSeconds
  )
  if (eligible.length === 0) return null
  return eligible.reduce((best, p) => (p.score > best.score ? p : best))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ai-job && bun test select.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add ai-job/select.js ai-job/select.test.js
git commit -m "Add pure meme-selection logic"
```

---

## Task 2: Schedule logic (`schedule.js`)

**Files:**
- Create: `ai-job/package.json`
- Create: `ai-job/schedule.js`
- Test: `ai-job/schedule.test.js`

- [ ] **Step 1: Create the module manifest**

```json
{
  "name": "ai-meme-poster",
  "version": "1.0.0",
  "description": "Post the top reddit meme since the last run",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "test": "bun test"
  },
  "license": "MIT",
  "dependencies": {
    "node-fetch": "3.3.0",
    "cron-parser": "5.5.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd ai-job && bun install`
Expected: installs `node-fetch` and `cron-parser`, creates `bun.lock`.

- [ ] **Step 3: Write the failing tests**

```js
// ai-job/schedule.test.js
import { test, expect } from 'bun:test'
import { previousRun, redditWindow } from './schedule.js'

// Weekly cron: Fridays 16:00. Run "now" is Fri 2026-05-22 16:00:05 UTC.
const NOW = new Date('2026-05-22T16:00:05Z')

test('previousRun: returns the fire before the current one', () => {
  const since = previousRun('0 16 * * fri', NOW, 'UTC')
  // current fire is 2026-05-22 16:00; previous is 2026-05-15 16:00
  expect(since.toISOString()).toBe('2026-05-15T16:00:00.000Z')
})

test('previousRun: falls back to now-7d on unparseable cron', () => {
  const since = previousRun('not a cron', NOW, 'UTC')
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  expect(since.getTime()).toBe(NOW.getTime() - sevenDaysMs)
})

test('redditWindow: maps gap size to reddit t value', () => {
  const h = (n) => new Date(NOW.getTime() - n * 3600 * 1000)
  expect(redditWindow(h(0.5), NOW)).toBe('hour')
  expect(redditWindow(h(20), NOW)).toBe('day')
  expect(redditWindow(h(24 * 6), NOW)).toBe('week')
  expect(redditWindow(h(24 * 20), NOW)).toBe('month')
  expect(redditWindow(h(24 * 200), NOW)).toBe('year')
})
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd ai-job && bun test schedule.test.js`
Expected: FAIL — `Cannot find module './schedule.js'`.

- [ ] **Step 5: Write minimal implementation**

```js
// ai-job/schedule.js
import { CronExpressionParser } from 'cron-parser'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// The previous scheduled fire before the current run.
// `now` is at (or just after) a fire, so the first prev() is the current
// fire and the second prev() is the previous run's fire.
export function previousRun(cronExpr, now = new Date(), tz = 'UTC') {
  try {
    const it = CronExpressionParser.parse(cronExpr, { currentDate: now, tz })
    it.prev() // current fire
    return it.prev().toDate() // previous fire
  } catch {
    return new Date(now.getTime() - SEVEN_DAYS_MS)
  }
}

// Smallest reddit "t" window that covers the gap since the last run.
export function redditWindow(sinceUtc, now = new Date()) {
  const gapHours = (now.getTime() - sinceUtc.getTime()) / 3600000
  if (gapHours <= 1) return 'hour'
  if (gapHours <= 24) return 'day'
  if (gapHours <= 24 * 7) return 'week'
  if (gapHours <= 24 * 31) return 'month'
  return 'year'
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd ai-job && bun test schedule.test.js`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add ai-job/package.json ai-job/bun.lock ai-job/schedule.js ai-job/schedule.test.js
git commit -m "Add stateless run-window logic from cron expression"
```

---

## Task 3: Reddit fetch (`reddit.js`)

**Files:**
- Create: `ai-job/reddit.js`

No unit test: thin IO wrapper over `fetch` and a field rename. Verified manually in Task 5.

- [ ] **Step 1: Write the implementation**

```js
// ai-job/reddit.js
import fetch from 'node-fetch'

const USER_AGENT = 'slack-meme-poster/1.0'

function normalize(data) {
  return {
    id: data.id,
    title: data.title,
    score: data.score,
    url: data.url,
    createdUtc: data.created_utc,
    postHint: data.post_hint,
    isVideo: data.is_video,
    over18: data.over_18,
  }
}

export async function fetchTopPosts(subreddit, window) {
  const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${window}&limit=100`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(`Reddit returned ${res.status} for ${url}`)
  }
  const json = await res.json()
  return json.data.children.map((c) => normalize(c.data))
}
```

- [ ] **Step 2: Commit**

```bash
git add ai-job/reddit.js
git commit -m "Add reddit top-posts fetcher"
```

---

## Task 4: Orchestrator (`index.js`)

**Files:**
- Create: `ai-job/index.js`

Reuses `../job/post-slack.js` (unchanged). Writes the image only to
`/memes/already-sent/` and posts `HOST_URL + 'already-sent/' + filename`.

- [ ] **Step 1: Write the implementation**

```js
// ai-job/index.js
import fs from 'fs'
import path from 'path'
import { URL } from 'url'
import fetch from 'node-fetch'
import { fetchTopPosts } from './reddit.js'
import { pickMeme } from './select.js'
import { previousRun, redditWindow } from './schedule.js'
import { postSlackMeme } from '../job/post-slack.js'

const USER_AGENT = 'slack-meme-poster/1.0'
const ALREADY_SENT = '/memes/already-sent'

function targetFilename(imageUrl, now) {
  const ext = path.extname(new URL(imageUrl).pathname) || '.jpg'
  const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
  let filename = `${date}${ext}`
  let n = 2
  while (fs.existsSync(path.join(ALREADY_SENT, filename))) {
    filename = `${date}-${n}${ext}`
    n++
  }
  return filename
}

async function downloadTo(imageUrl, destPath) {
  const res = await fetch(imageUrl, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Image download returned ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
}

async function main() {
  const subreddit = process.env.AI_SUBREDDIT
  if (!subreddit) {
    console.error('AI_SUBREDDIT not set; nothing to do')
    process.exit(1)
  }

  const now = new Date()
  const since = previousRun(process.env.AI_POST_CRON, now, process.env.TZ)
  const window = redditWindow(since, now)
  console.log(`r/${subreddit} top?t=${window} since ${since.toISOString()}`)

  let posts
  try {
    posts = await fetchTopPosts(subreddit, window)
  } catch (err) {
    console.error('Reddit fetch failed:', err.message)
    process.exit(1)
  }

  const winner = pickMeme(posts, since)
  if (!winner) {
    console.log('Nothing new to post')
    process.exit(0)
  }
  console.log(`Picked "${winner.title}" (${winner.score} upvotes): ${winner.url}`)

  const filename = targetFilename(winner.url, now)
  try {
    await downloadTo(winner.url, path.join(ALREADY_SENT, filename))
  } catch (err) {
    console.error('Download failed:', err.message)
    process.exit(1)
  }

  await postSlackMeme(process.env.HOST_URL + 'already-sent/' + filename)
  console.log('Posted', filename)
}

main()
```

- [ ] **Step 2: Sanity-check imports resolve**

Run: `cd ai-job && node --check index.js`
Expected: no output (syntax OK). (`node --check` does not run `main()`.)

- [ ] **Step 3: Commit**

```bash
git add ai-job/index.js
git commit -m "Add ai-job orchestrator"
```

---

## Task 5: Manual end-to-end smoke test (local)

**Files:** none (verification only).

- [ ] **Step 1: Run the full pure test suite**

Run: `cd ai-job && bun test`
Expected: PASS (10 tests across both files).

- [ ] **Step 2: Dry-run the fetch + selection against live Reddit**

Run:
```bash
cd ai-job
AI_SUBREDDIT=ProgrammerHumor node --input-type=module -e "
import { fetchTopPosts } from './reddit.js'
import { pickMeme } from './select.js'
const posts = await fetchTopPosts('ProgrammerHumor', 'week')
console.log('fetched', posts.length, 'posts')
const w = pickMeme(posts, new Date(Date.now() - 7*864e5))
console.log('winner:', w && { title: w.title, score: w.score, url: w.url })
"
```
Expected: prints a post count (often 25-100) and a winner with an image URL.
If Reddit returns 403/429 from this machine, that is the known public-endpoint
risk — the NAS IP may behave differently. Note it and continue; do not treat it
as a code failure.

- [ ] **Step 2b: No commit** (verification task).

---

## Task 6: Dockerfile — bump base + include ai-job

**Files:**
- Modify: `Dockerfile`

Current content:
```dockerfile
FROM node:16-alpine

RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY start.sh ./
COPY job/*.* ./job/

RUN dos2unix start.sh job/*.*

CMD ["./start.sh"]
```

- [ ] **Step 1: Replace with the updated Dockerfile**

```dockerfile
FROM node:20-alpine

RUN apk add --update --no-cache bash dos2unix

WORKDIR /usr/scheduler

COPY start.sh ./
COPY job/*.* ./job/
COPY ai-job/*.* ./ai-job/

RUN dos2unix start.sh job/*.* ai-job/*.*

CMD ["./start.sh"]
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "Bump base image to node:20-alpine and copy ai-job"
```

---

## Task 7: start.sh — install deps, optional startup run, conditional crontab

**Files:**
- Modify: `start.sh`

Current content:
```bash
#!/bin/bash

echo "Node: $(node -v)"


cd ./job
npm install
if [ "$POST_MEME_ON_STARTUP" ]; then
  npm start
fi
cd ../


# POST_CRON='0 16 * * fri'
echo "Scheduling posting at: ${POST_CRON}"
CRON_CMD="${POST_CRON} node /usr/scheduler/job/meme-poster.js"
echo "$CRON_CMD" > crontab.txt

crontab crontab.txt
crond -f
```

- [ ] **Step 1: Replace with the updated start.sh**

```bash
#!/bin/bash

echo "Node: $(node -v)"


cd ./job
npm install
if [ "$POST_MEME_ON_STARTUP" ]; then
  npm start
fi
cd ../


cd ./ai-job
npm install
if [ "$AI_POST_ON_STARTUP" ]; then
  npm start
fi
cd ../


# POST_CRON='0 16 * * fri'
echo "Scheduling posting at: ${POST_CRON}"
echo "${POST_CRON} node /usr/scheduler/job/meme-poster.js" > crontab.txt

# Only schedule the AI job when a subreddit is configured.
if [ "$AI_SUBREDDIT" ]; then
  echo "Scheduling AI posting at: ${AI_POST_CRON}"
  echo "${AI_POST_CRON} node /usr/scheduler/ai-job/index.js" >> crontab.txt
fi

crontab crontab.txt
crond -f
```

- [ ] **Step 2: Commit**

```bash
git add start.sh
git commit -m "Wire ai-job into startup and crontab (opt-in via AI_SUBREDDIT)"
```

---

## Task 8: docker-compose + .env.sample

**Files:**
- Modify: `docker-compose.yaml`
- Modify: `.env.sample`

- [ ] **Step 1: Add AI_* env to the `cron_job` service**

In `docker-compose.yaml`, under `cron_job:` → `environment:`, the existing block is:
```yaml
    environment:
      SLACK_WEBHOOK: ${SLACK_WEBHOOK}
      HOST_URL: ${HOST_URL}
      POST_MEME_ON_STARTUP: ${POST_MEME_ON_STARTUP}
      POST_CRON: ${POST_CRON}
      TZ: ${TZ}
```
Replace it with:
```yaml
    environment:
      SLACK_WEBHOOK: ${SLACK_WEBHOOK}
      HOST_URL: ${HOST_URL}
      POST_MEME_ON_STARTUP: ${POST_MEME_ON_STARTUP}
      POST_CRON: ${POST_CRON}
      AI_SUBREDDIT: ${AI_SUBREDDIT}
      AI_POST_CRON: ${AI_POST_CRON}
      AI_POST_ON_STARTUP: ${AI_POST_ON_STARTUP}
      TZ: ${TZ}
```

- [ ] **Step 2: Document the new vars in `.env.sample`**

Append after the existing `POST_CRON` / `MEMES_DIR` block (before the Slack section), insert:
```sh
# AI meme job (reddit) configuration:
# Leave AI_SUBREDDIT empty to disable the AI job entirely.
# The large active sub is "ProgrammerHumor" (the linked r/programminghumor is a small alt).
AI_SUBREDDIT=ProgrammerHumor
# When to post the reddit meme. Default: every monday at 9h
AI_POST_CRON=0 9 * * mon
# Set to non-empty to also post once on container start
AI_POST_ON_STARTUP=
```

- [ ] **Step 3: Validate compose syntax**

Run: `docker compose config -q`
Expected: no output (valid). If `.env` lacks the new vars, compose substitutes empty strings — that is fine.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yaml .env.sample
git commit -m "Add AI meme job env vars to compose and sample"
```

---

## Task 9: README — document the second job

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the existing TODO list item with a done note**

In `README.md`, the TODO block contains:
```
- Scrape reddit/programmingHumour and pick the "best" meme from the last week
```
Replace that single line with:
```
- ~~Scrape reddit/programmingHumour and pick the "best" meme from the last week~~ → see "AI meme job" below
```

- [ ] **Step 2: Add a short section after the `## Permissions` section**

```markdown
## AI meme job

A second, opt-in cron job posts the top-upvoted still-image from a subreddit,
covering everything posted since its previous run. Configure in `.env`:

| Var                  | Meaning                                              |
|----------------------|------------------------------------------------------|
| `AI_SUBREDDIT`       | Subreddit to scrape. **Empty = job disabled.**       |
| `AI_POST_CRON`       | Cron schedule for the AI job.                         |
| `AI_POST_ON_STARTUP` | Non-empty to also post once on container start.       |

It downloads the winner as `YYYY-MM-DD.<ext>` into `memes/already-sent/` and
posts it through the same Slack webhook. Videos and galleries are skipped (see
the bot-token TODO for video support).
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document the AI meme job in README"
```

---

## Verification Checklist (run before declaring done)

- [ ] `cd ai-job && bun test` → 10 passing tests.
- [ ] `cd ai-job && node --check index.js` → clean.
- [ ] `docker compose config -q` → clean.
- [ ] `docker compose build` → image builds on node:20-alpine.
- [ ] With `AI_SUBREDDIT` empty, the container's `crontab.txt` has only the
      `POST_CRON` line; with it set, it has both lines.
