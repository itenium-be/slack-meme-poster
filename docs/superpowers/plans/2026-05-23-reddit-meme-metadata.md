# Reddit Meme Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the reddit Slack post with a clickable title-link, randomise the header line, and put a title slug into the saved filename — backward-compatibly through the shared `job/post-slack.js`.

**Architecture:** Add an optional `meta` param to `postSlackMeme`. Extract a pure `buildMemeBlocks(imageUrl, headerText, meta?)` that returns the Block Kit blocks. The header line comes from a pure `pickHeader()` selecting uniformly from a curated `HEADERS` array. The reddit title is mrkdwn-escaped before being inlined into the `<url|text>` section block. The reddit-job builds the full reddit permalink URL and adds a slug from a new pure `slugify(title)` into the saved filename.

**Tech Stack:** Node 20 (container), Bun (dev/test), node-fetch, cron-parser (unchanged).

---

## File Structure

| File | Responsibility | New/Modify |
|------|----------------|------------|
| `reddit-job/slug.js`         | **Pure** `slugify(title)`.                                          | Create |
| `reddit-job/slug.test.js`    | Bun tests for `slug.js`.                                            | Create |
| `job/post-slack.js`      | Add `HEADERS`, pure `pickHeader`/`escapeMrkdwn`/`buildMemeBlocks`; `postSlackMeme` gains optional `meta`. | Modify |
| `job/post-slack.test.js` | Bun tests for the new pure helpers.                                  | Create |
| `job/package.json`       | Add `"test": "bun test"` script (job has no test runner yet).        | Modify |
| `reddit-job/reddit.js`       | Add `permalink` to the normalized post.                              | Modify |
| `reddit-job/index.js`        | Pass `winner.title` into `targetFilename`; build `redditUrl`; pass `meta` to `postSlackMeme`. | Modify |

---

## Task 1: Pure slugify (`reddit-job/slug.js`)

**Files:**
- Create: `reddit-job/slug.js`
- Test: `reddit-job/slug.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// reddit-job/slug.test.js
import { test, expect } from 'bun:test'
import { slugify } from './slug.js'

test('slugify: normal title becomes lowercase kebab', () => {
  expect(slugify('When The Code Finally Works')).toBe('when-the-code-finally-works')
})

test('slugify: collapses punctuation and whitespace', () => {
  expect(slugify("Hello,  world!! It's me.")).toBe('hello-world-it-s-me')
})

test('slugify: trims leading and trailing separators', () => {
  expect(slugify('---weird---title---')).toBe('weird-title')
})

test('slugify: truncates to 50 chars and re-trims trailing dash', () => {
  // 60-char input where char 51 lands on a separator, so re-trim must kick in
  const title = 'a'.repeat(50) + ' ' + 'b'.repeat(20)
  const out = slugify(title)
  expect(out.length).toBeLessThanOrEqual(50)
  expect(out.endsWith('-')).toBe(false)
})

test('slugify: returns empty string when nothing usable remains', () => {
  expect(slugify('!!!???')).toBe('')
  expect(slugify('')).toBe('')
})

test('slugify: keeps digits', () => {
  expect(slugify('Go 1.22 release notes')).toBe('go-1-22-release-notes')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd reddit-job && bun test slug.test.js`
Expected: FAIL — `Cannot find module './slug.js'`.

- [ ] **Step 3: Write the implementation**

```js
// reddit-job/slug.js
const MAX_LEN = 50

export function slugify(title) {
  const cleaned = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LEN)
    .replace(/-+$/g, '')
  return cleaned
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd reddit-job && bun test slug.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add reddit-job/slug.js reddit-job/slug.test.js
git commit -m "Add pure slugify for reddit titles"
```

---

## Task 2: Refactor `job/post-slack.js` (header pool + buildMemeBlocks + optional meta)

**Files:**
- Modify: `job/post-slack.js`
- Create: `job/post-slack.test.js`
- Modify: `job/package.json`

The current `job/post-slack.js` is:
```js
import fetch from 'node-fetch'

const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
const messageToPostWithMeme = `${currentDayName} vibes, everyone! 😎`


// Alternative messages:
// Fri-nally, team! Hang in there for a little while longer! 🎉
// Weekend vibes incoming, everyone! 😎"
// "Counting down to the weekend, team! 🎉"
// "Ready for some weekend fun, folks? Let's do this! 🚀"
// "The weekend is on its way, squad! Get ready to unwind! 🌟"
// "Anticipating the weekend adventures, all! Hang in there! 🏖️"


const webhookUrl = process.env.SLACK_WEBHOOK
// console.log(`Using webhook: ${webhookUrl}`)


// Configure your message via (super handy!)
// https://app.slack.com/block-kit-builder/


export async function postSlackMeme(imageUrl) {
  const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
  console.log('About to post meme:', fileName)
  console.log('Full url:', imageUrl);

  await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: messageToPostWithMeme
          }
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: fileName,
            emoji: true
          },
          // image_url: 'https://pbs.twimg.com/profile_images/625633822235693056/lNGUneLX_400x400.jpg',
          image_url: imageUrl,
          alt_text: fileName
        }
      ]
    }),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
}
```

- [ ] **Step 1: Write the failing tests**

```js
// job/post-slack.test.js
import { test, expect } from 'bun:test'
import {
  HEADERS,
  pickHeader,
  escapeMrkdwn,
  buildMemeBlocks,
} from './post-slack.js'

test('HEADERS contains the curated five lines', () => {
  expect(HEADERS).toEqual([
    'git commit -m "meme" ✅',
    "Stop the build — it's meme o'clock 🕒",
    'Fresh meme incoming! 🚀',
    'A wild meme appeared! ✨',
    'Hot off the press 📰',
  ])
})

test('pickHeader returns a member of HEADERS', () => {
  for (let i = 0; i < 50; i++) {
    expect(HEADERS).toContain(pickHeader())
  }
})

test('escapeMrkdwn escapes &, <, > and leaves other chars alone', () => {
  expect(escapeMrkdwn('a & b < c > d "e" |f|')).toBe('a &amp; b &lt; c &gt; d "e" |f|')
})

test('buildMemeBlocks: daily shape (no meta) is header + image', () => {
  const blocks = buildMemeBlocks('https://h/x/y.jpg', 'Hello')
  expect(blocks).toHaveLength(2)
  expect(blocks[0]).toEqual({
    type: 'header',
    text: { type: 'plain_text', text: 'Hello' },
  })
  expect(blocks[1].type).toBe('image')
  expect(blocks[1].image_url).toBe('https://h/x/y.jpg')
  expect(blocks[1].alt_text).toBe('y.jpg')
  expect(blocks[1].title).toEqual({ type: 'plain_text', text: 'y.jpg', emoji: true })
})

test('buildMemeBlocks: reddit shape (with meta) inserts mrkdwn section', () => {
  const blocks = buildMemeBlocks(
    'https://h/x/2026-05-23-foo.jpg',
    'Hello',
    { title: 'Foo & <bar>', url: 'https://www.reddit.com/r/x/comments/1/foo/' },
  )
  expect(blocks).toHaveLength(3)
  expect(blocks[0].type).toBe('header')
  expect(blocks[1]).toEqual({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '🔗 *<https://www.reddit.com/r/x/comments/1/foo/|Foo &amp; &lt;bar&gt;>*',
    },
  })
  expect(blocks[2].type).toBe('image')
})
```

- [ ] **Step 2: Add the test script to `job/package.json`**

Replace `job/package.json` with (only difference: a `test` script is added):

```json
{
  "name": "meme-poster",
  "version": "0.9.0",
  "description": "Post a random meme to x every y",
  "type": "module",
  "scripts": {
    "start": "node meme-poster.js",
    "test": "bun test"
  },
  "author": "",
  "license": "MIT",
  "dependencies": {
    "node-fetch": "3.3.0"
  }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd job && bun test post-slack.test.js`
Expected: FAIL — the named exports do not exist yet (the file currently only exports `postSlackMeme`).

- [ ] **Step 4: Rewrite `job/post-slack.js`**

Replace the whole file with:

```js
import fetch from 'node-fetch'

// Configure messages via https://app.slack.com/block-kit-builder/

export const HEADERS = [
  'git commit -m "meme" ✅',
  "Stop the build — it's meme o'clock 🕒",
  'Fresh meme incoming! 🚀',
  'A wild meme appeared! ✨',
  'Hot off the press 📰',
]

export function pickHeader() {
  return HEADERS[Math.floor(Math.random() * HEADERS.length)]
}

// Reddit titles can contain `<`, `>`, `&`, which would break the <url|text>
// link syntax of Slack mrkdwn. Escape them, leave everything else alone.
export function escapeMrkdwn(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildMemeBlocks(imageUrl, headerText, meta) {
  const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerText },
    },
  ]
  if (meta) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔗 *<${meta.url}|${escapeMrkdwn(meta.title)}>*`,
      },
    })
  }
  blocks.push({
    type: 'image',
    title: { type: 'plain_text', text: fileName, emoji: true },
    image_url: imageUrl,
    alt_text: fileName,
  })
  return blocks
}

const webhookUrl = process.env.SLACK_WEBHOOK

export async function postSlackMeme(imageUrl, meta) {
  const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
  console.log('About to post meme:', fileName)
  console.log('Full url:', imageUrl)

  await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({ blocks: buildMemeBlocks(imageUrl, pickHeader(), meta) }),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
}
```

- [ ] **Step 5: Install bun for job/ tests if needed and run them**

Run: `cd job && bun install && bun test post-slack.test.js`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add job/post-slack.js job/post-slack.test.js job/package.json job/bun.lock
git commit -m "Extract pure block builder; add header pool and optional meta"
```

---

## Task 3: `reddit.js` — add `permalink` to normalize

**Files:**
- Modify: `reddit-job/reddit.js`

- [ ] **Step 1: Add the field to `normalize`**

In `reddit-job/reddit.js`, the `normalize` function returns an object with 8 fields. Add `permalink: data.permalink` as a 9th field. The full updated function:

```js
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
    permalink: data.permalink,
  }
}
```

- [ ] **Step 2: Sanity check**

Run: `cd reddit-job && node --check reddit.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add reddit-job/reddit.js
git commit -m "Include permalink in normalized reddit post"
```

---

## Task 4: `reddit-job/index.js` — slug filename + pass meta

**Files:**
- Modify: `reddit-job/index.js`

Current `reddit-job/index.js` defines `targetFilename(imageUrl, now)` and calls `postSlackMeme(process.env.HOST_URL + 'already-sent/' + filename)`. We need to thread the reddit title into the filename and pass `meta` to the poster.

- [ ] **Step 1: Add the `slugify` import**

At the top of `reddit-job/index.js`, after the other local imports (`./reddit.js`, `./select.js`, `./schedule.js`), add:

```js
import { slugify } from './slug.js'
```

- [ ] **Step 2: Update `targetFilename` to take and use a title**

Replace the existing `targetFilename` function with:

```js
function targetFilename(imageUrl, now, title) {
  const ext = path.extname(new URL(imageUrl).pathname) || '.jpg'
  const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const slug = slugify(title)
  const base = slug ? `${date}-${slug}` : date
  let filename = `${base}${ext}`
  let n = 2
  while (fs.existsSync(path.join(ALREADY_SENT, filename))) {
    filename = `${base}-${n}${ext}`
    n++
  }
  return filename
}
```

- [ ] **Step 3: Pass the title to `targetFilename` and add reddit `meta` to the post call**

In `main()`, replace the existing pair of lines:

```js
  const filename = targetFilename(winner.url, now)
```
with:
```js
  const filename = targetFilename(winner.url, now, winner.title)
```

And replace the existing `postSlackMeme(...)` invocation block:
```js
  try {
    await postSlackMeme(process.env.HOST_URL + 'already-sent/' + filename)
  } catch (err) {
    console.error('Slack post failed:', err.message)
    process.exit(1)
  }
```
with:
```js
  const redditUrl = 'https://www.reddit.com' + winner.permalink
  try {
    await postSlackMeme(process.env.HOST_URL + 'already-sent/' + filename, {
      title: winner.title,
      url: redditUrl,
    })
  } catch (err) {
    console.error('Slack post failed:', err.message)
    process.exit(1)
  }
```

- [ ] **Step 4: Sanity check**

Run: `cd reddit-job && node --check index.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add reddit-job/index.js
git commit -m "Use title slug in filename and post reddit meta to Slack"
```

---

## Task 5: Full test sweep + dry-run smoke test

**Files:** none (verification only).

- [ ] **Step 1: Run all pure tests across both jobs**

Run:
```bash
cd reddit-job && bun test
cd ../job && bun test
```
Expected: all tests pass (10 reddit-job + 5 job).

- [ ] **Step 2: Syntax check all touched JS**

Run:
```bash
cd reddit-job && node --check index.js && node --check reddit.js && node --check slug.js
cd ../job && node --check post-slack.js
```
Expected: no output.

- [ ] **Step 3: Live dry-run of the new fields end-to-end (no Slack post, no write)**

Run (from repo root):
```bash
node --input-type=module -e "
import { fetchTopPosts } from './reddit-job/reddit.js'
import { pickMeme } from './reddit-job/select.js'
import { previousRun, redditWindow } from './reddit-job/schedule.js'
import { slugify } from './reddit-job/slug.js'
import { buildMemeBlocks, pickHeader } from './job/post-slack.js'
const now = new Date()
const since = previousRun('0 9 * * mon', now, 'Europe/Brussels')
const posts = await fetchTopPosts('ProgrammerHumor', redditWindow(since, now))
const w = pickMeme(posts, since)
if (!w) { console.log('no winner'); process.exit(0) }
const slug = slugify(w.title)
const filename = now.toISOString().slice(0,10) + (slug ? '-' + slug : '') + '.jpg'
const redditUrl = 'https://www.reddit.com' + w.permalink
console.log('title :', w.title)
console.log('slug  :', slug)
console.log('file  :', filename)
console.log('reddit:', redditUrl)
console.log('blocks:', JSON.stringify(buildMemeBlocks('http://host/'+filename, pickHeader(), { title: w.title, url: redditUrl }), null, 2))
"
```
Expected: prints title, slug, filename, reddit URL, and a 3-element blocks array with a `section` block containing the linked title. If reddit returns 403/429 from this machine, note it as the documented public-endpoint risk and continue — the production NAS may behave differently.

- [ ] **Step 4: No commit** (verification only).

---

## Verification Checklist (run before declaring done)

- [ ] `cd reddit-job && bun test` passes (10 tests: 9 existing + 1 new file with 6).
- [ ] `cd job && bun test` passes (5 tests).
- [ ] `node --check` clean for `reddit-job/{index,reddit,slug}.js` and `job/post-slack.js`.
- [ ] Daily job's call site (`job/meme-poster.js`) is **unchanged** and still compiles: `node --check job/meme-poster.js`.
- [ ] `git diff main..HEAD --stat` only touches the planned files.
