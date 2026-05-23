# Reddit Meme Metadata — Design Spec

**Date:** 2026-05-23
**Status:** Approved (pending implementation)

## Summary

Enrich the reddit-posted meme on Slack with:

1. The reddit post **title**, shown as a bold clickable link to the reddit
   thread (one combined element — `<permalink|title>`).
2. A randomised **header** pulled from a curated 5-line pool, shared by both
   jobs (replaces the previous day-based `"{Day} vibes, everyone! 😎"`).
3. An archive **filename** that includes a slug of the title:
   `YYYY-MM-DD-<slug>.<ext>`.

The shared `job/post-slack.js` is extended **backward-compatibly** so the
existing daily job's output is unchanged in structure — only the header line
becomes randomised (it was always shared code).

## Scope

**In scope**

- `job/post-slack.js`: header pool + random pick; pure `buildMemeBlocks` block
  builder; optional `meta` (`{ title, url }`) on `postSlackMeme`; mrkdwn
  escaping for the title.
- `reddit-job/slug.js`: pure `slugify(title)`.
- `reddit-job/index.js`: build the full reddit URL from `permalink`, slugify the
  title into the filename, pass `meta` to `postSlackMeme`.
- `reddit-job/reddit.js`: include `permalink` in the normalized post.
- TDD tests for the pure modules.

**Out of scope (deferred)**

- Replacing the webhook with a Slack bot token + `files.uploadV2`. Tracked in
  `CreateSlackBot.md` and the README TODO. The follow-up will also add an
  `already-sent/from-reddit/` subfolder for reddit-sourced files.
- Video / `v.redd.it` handling (depends on the bot-token migration).

## Layout

```
{random header from pool}            <- header block (plain text)
🔗 *{title (linked to thread)}*       <- section block (mrkdwn), reddit only
[ image ]                             <- image block (unchanged)
```

The section block is **omitted** when `postSlackMeme` is called without `meta`
(i.e. by the daily job), keeping the daily output a header + image.

## Header pool (5 lines, day-neutral)

```
git commit -m "meme" ✅
Stop the build — it's meme o'clock 🕒
Fresh meme incoming! 🚀
A wild meme appeared! ✨
Hot off the press 📰
```

One is chosen uniformly at random per post via `pickHeader()`.

## Architecture

Approach A from brainstorming: optional `meta` parameter on `postSlackMeme`,
with the block-building extracted to a pure function so it can be unit-tested.

### Components

| Module                  | Responsibility                                                                                                                              | Purity |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|--------|
| `job/post-slack.js`     | Exports `postSlackMeme(imageUrl, meta?)` (IO, thin fetch wrapper) plus pure helpers `buildMemeBlocks(imageUrl, headerText, meta?)`, `pickHeader()`, `escapeMrkdwn(text)`, and the `HEADERS` array. | mixed  |
| `reddit-job/slug.js`        | Pure `slugify(title)`.                                                                                                                       | pure   |
| `reddit-job/reddit.js`      | Adds `permalink` to the normalized post.                                                                                                     | IO     |
| `reddit-job/index.js`       | Builds `redditUrl = 'https://www.reddit.com' + permalink`, passes title into `targetFilename`, calls `postSlackMeme(url, { title, url: redditUrl })`. | IO     |

### `postSlackMeme(imageUrl, meta?)`

- `meta` (optional): `{ title: string, url: string }`.
- Calls `buildMemeBlocks(imageUrl, pickHeader(), meta)` then POSTs to the webhook.
- Signature is backward-compatible: the existing call `postSlackMeme(url)` in
  `job/meme-poster.js` keeps working with no change.

### `buildMemeBlocks(imageUrl, headerText, meta?)`

Pure. Returns a Block Kit blocks array:

- Always: `{ type: 'header', text: { type: 'plain_text', text: headerText } }`.
- If `meta`: `{ type: 'section', text: { type: 'mrkdwn', text: ``🔗 *<${meta.url}|${escapeMrkdwn(meta.title)}>*`` } }`.
- Always: `{ type: 'image', image_url: imageUrl, alt_text: fileName, title: { type: 'plain_text', text: fileName, emoji: true } }` where `fileName` is derived from the last path segment of `imageUrl` (matches today's behavior).

### `escapeMrkdwn(text)`

Pure. Replaces `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`. Required because
reddit titles can contain `<` / `>` / `&` which would break the
`<url|text>` link syntax.

### `slugify(title)`

Pure. Rules:

1. Lowercase.
2. Replace any run of non-`[a-z0-9]` characters with a single `-`.
3. Trim leading/trailing `-`.
4. Truncate to 50 characters, then re-trim trailing `-`.
5. Return `''` if nothing usable remains.

Returning `''` is the documented signal that the caller should omit the slug
portion of the filename.

### `targetFilename(imageUrl, now, title)` (updated, in `index.js`)

- `ext` from URL pathname (default `.jpg`).
- `date = now.toISOString().slice(0,10)`.
- `slug = slugify(title)`.
- `base = date + (slug ? '-' + slug : '')`.
- Returns `<base>.<ext>` with the existing `-2`, `-3` collision suffix if a
  same-named file already exists in `memes/already-sent/`.

### `reddit.js` normalize

Adds one field:
```js
permalink: data.permalink   // e.g. "/r/ProgrammerHumor/comments/abc/title/"
```

## Data flow (one reddit-job run)

Unchanged except for the boxed steps:

1. `previousRun` → cutoff. 2. `redditWindow` → reddit `t`. 3. `fetchTopPosts`.
4. `pickMeme(posts, since)` → winner (now also carries `permalink` + `title`).
5. **`filename = targetFilename(winner.url, now, winner.title)`**
   → e.g. `2026-05-23-when-the-code-finally-works.jpeg`.
6. Download to `memes/already-sent/<filename>`.
7. **`redditUrl = 'https://www.reddit.com' + winner.permalink`**.
8. **`postSlackMeme(HOST_URL + 'already-sent/' + filename, { title: winner.title, url: redditUrl })`**.

## Error handling

Unchanged from existing job. The new code paths are pure (no new IO or failure
modes). `escapeMrkdwn` and `slugify` always return a string.

## Testing

Per project TDD. Two new test files, all pure (`bun test`).

- `reddit-job/slug.test.js`
  - normal title → kebab-case slug,
  - punctuation/whitespace collapsed,
  - leading/trailing hyphens trimmed,
  - truncation at 50 chars with no trailing hyphen,
  - symbol-only title → `''`.
- `job/post-slack.test.js`
  - `buildMemeBlocks(url, header)` → header + image only (daily shape),
  - `buildMemeBlocks(url, header, { title, url })` → header + section + image; section uses mrkdwn with `<url|title>`,
  - `escapeMrkdwn` escapes `&`, `<`, `>` (and passes through everything else),
  - `pickHeader()` returns a member of `HEADERS`,
  - `HEADERS` contains the 5 expected lines.

`reddit.js` and `index.js` remain thin IO and are not unit-tested.

## Daily-job impact

The daily job (`job/meme-poster.js`) is **not** modified. Its call
`postSlackMeme(memeUrl)` continues to work — `meta` is `undefined`, no section
block is added, output structure is identical. The only observable change is
that its header line now rotates randomly through the 5 pool entries instead
of saying `"{Day} vibes, everyone! 😎"`. That message was always shared code;
this brings it in line with the new shared header semantics.

## Backward compatibility

| Caller                  | Change                          | Output change      |
|-------------------------|---------------------------------|--------------------|
| `job/meme-poster.js`    | none (same call signature)       | header line text only |
| `reddit-job/index.js`        | now passes `{ title, url }` + slug filename | new section block, slug in filename |
