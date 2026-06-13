# Coolify Deploy + Slack Bot Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `slack-meme-poster` off the Slack incoming webhook to a Slack bot (`files.uploadV2`), retire the public file server, and deploy it to homelab Coolify (apps-01) as a domain-less cron worker with prod (`main`→itenium) and dev (`dev`→pongit) tiers driven by the `coolify-apps.ts` manifest.

**Architecture:** The bot uploads the local image file directly, so no public URL / `file_server` is needed; the container just runs `crond`. Memes live on `nas-work`, NFS-mounted to apps-01 at `/mnt/dropbox`, bound into the container via `${MEMES_DIR}:/memes`. Two Coolify resources (prod/dev) come from one manifest entry; secrets + the per-tier memes path are set per-resource in the Coolify UI.

**Tech Stack:** Node 20, `@slack/web-api`, Docker Compose, Coolify v4.1.2 API, Bun (tests + Home-repo sync tooling, TypeScript).

**Two repos:**
- **App** — `itenium-be/slack-meme-poster` (this repo): Tasks 1–4.
- **Home** — `homelab/coolify` + runbook (`/mnt/c/Users/woute/Dropbox/Personal/Programming/UnixCode/_personal/Home`): Tasks 5–8.
- **Deploy** — one-time manual wiring: Task 9.

---

## File structure

| File | Repo | Responsibility |
|------|------|----------------|
| `job/post-slack.js`        | App  | Slack bot upload + comment building (replaces webhook) |
| `job/post-slack.test.js`   | App  | Tests for pure helpers (`pickHeader`, `escapeMrkdwn`, `buildComment`) |
| `job/meme-poster.js`       | App  | Friday job: pick → move → upload local file |
| `reddit-job/index.js`      | App  | Reddit job: upload local file (kept coherent, stays disabled) |
| `docker-compose.yaml`      | App  | Single `cron_job` service, `${MEMES_DIR}:/memes` bind |
| `.env.sample`              | App  | Bot/channel/memes env; webhook + file-server vars removed |
| `job/package.json`         | App  | Add `@slack/web-api` |
| `homelab/coolify/target.ts`     | Home | `githubApps` org→uuid registry |
| `homelab/coolify/plan.ts`       | Home | Domain-optional worker support + org-derived GitHub App |
| `homelab/coolify/plan.test.ts`  | Home | Tests for the above |
| `homelab/coolify/coolify-apps.ts` | Home | New worker manifest entry |
| `homelab/docs/runbooks/11-coolify.md` | Home | NFS mount + one-time deploy steps |

---

## Task 1: Migrate `post-slack.js` to the Slack bot

**Files:**
- Modify: `job/post-slack.js`
- Test: `job/post-slack.test.js`

The pure helpers `pickHeader` and `escapeMrkdwn` are unchanged. `buildMemeBlocks` (which built a Block Kit `image_url` message) is replaced by `buildComment`, which produces the `initial_comment` mrkdwn shown above the uploaded file. `postSlackMeme` changes signature from `(imageUrl, meta)` to `(filePath, meta)`.

- [ ] **Step 1: Replace the `buildMemeBlocks` tests with `buildComment` tests**

In `job/post-slack.test.js`, change the import line and replace the two `buildMemeBlocks` tests with `buildComment` tests. Final import + new tests:

```js
import {
  HEADERS,
  pickHeader,
  escapeMrkdwn,
  buildComment,
} from './post-slack.js'
```

Delete both `buildMemeBlocks: …` tests and add:

```js
test('buildComment: no meta is just the header', () => {
  expect(buildComment('Hello')).toBe('Hello')
})

test('buildComment: with meta appends an escaped reddit title link', () => {
  expect(
    buildComment('Hello', {
      title: 'Foo & <bar>',
      url: 'https://www.reddit.com/r/x/comments/1/foo/',
    }),
  ).toBe('Hello\n🔗 *<https://www.reddit.com/r/x/comments/1/foo/|Foo &amp; &lt;bar&gt;>*')
})
```

(Keep the `HEADERS`, `pickHeader`, and `escapeMrkdwn` tests exactly as they are.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd job && bun test post-slack.test.js`
Expected: FAIL — `buildComment` is not exported (import is undefined).

- [ ] **Step 3: Rewrite `post-slack.js` to use the bot**

Replace the entire contents of `job/post-slack.js` with:

```js
import fs from 'fs'
import { WebClient } from '@slack/web-api'

// Configure messages via https://app.slack.com/block-kit-builder/

export const HEADERS = [
  'git commit -m "meme" ✅',
  "Stop the build — it's meme o'clock 🕒",
  'Fresh meme incoming! 🚀',
  'A wild meme appeared! ✨',
  'Hot off the press 📰',
  'sudo deliver-meme --force ⚡',
  'Merging meme into main… ✅',
  'It compiled. Send meme. 📤',
  'cat /dev/memes 🐱',
  'Rollback canceled — meme detected 🎯',
  'One does not simply skip the meme 🧙‍♂️',
  'A wild *new* meme appeared! ✨',
  "99 problems, this meme isn't one 🎵",
  "It's dangerous to go alone — take this meme 🗡️",
  'Behold 👀',
  '🥁 *drumroll* 🥁',
  'Brace for impact! 💥',
  'O(1) meme delivery ⚡',
  'Refactored: now with 100% more meme 💯',
  'Patch notes: +1 meme 🩹',
  'Build passed: deploying meme 🟢',
  'Trained on memes since 2007 📚',
  'Powered by caffeine and despair ☕🖤',
  "This meeting could've been a meme 📅",
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

// The text shown above the uploaded file (Slack `initial_comment`, mrkdwn).
// meta.url is not escaped: reddit canonical URLs never contain `|` or `>`.
export function buildComment(headerText, meta) {
  if (!meta) return headerText
  return `${headerText}\n🔗 *<${meta.url}|${escapeMrkdwn(meta.title)}>*`
}

const client = new WebClient(process.env.SLACK_BOT_TOKEN)
const channel = process.env.SLACK_CHANNEL_ID

export async function postSlackMeme(filePath, meta) {
  const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
  console.log('About to upload meme:', fileName)

  await client.files.uploadV2({
    channel_id: channel,
    file: fs.readFileSync(filePath),
    filename: fileName,
    initial_comment: buildComment(pickHeader(), meta),
  })
}
```

- [ ] **Step 4: Install the new dependency so the import resolves**

Run: `cd job && bun add @slack/web-api && bun remove node-fetch`
Expected: `@slack/web-api` added to `job/package.json`; `node-fetch` removed (no longer used here). `bun.lock` updated.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd job && bun test post-slack.test.js`
Expected: PASS (all `HEADERS`/`pickHeader`/`escapeMrkdwn`/`buildComment` tests green).

- [ ] **Step 6: Commit**

```bash
git add job/post-slack.js job/post-slack.test.js job/package.json job/bun.lock
git commit -m "Replace Slack webhook with bot files.uploadV2"
```

---

## Task 2: Update the job call sites to pass a local file path

**Files:**
- Modify: `job/meme-poster.js`
- Modify: `reddit-job/index.js`

`postSlackMeme` now takes a local file path, not a URL. Both jobs already have the file on disk after moving/downloading it.

- [ ] **Step 1: Update `meme-poster.js`**

Replace the entire contents of `job/meme-poster.js` with:

```js
import { postSlackMeme } from './post-slack.js'
import fs from 'fs'


// Find a random meme
const notMemes = ['.gitkeep', '@eaDir', 'already-sent', 'cat.jpg', 'not-sending']
const allMemes = fs.readdirSync('/memes').filter(fn => !notMemes.includes(fn))
const theMeme = allMemes[Math.floor(Math.random() * allMemes.length)]

const sentPath = `/memes/already-sent/${theMeme}`
fs.renameSync(`/memes/${theMeme}`, sentPath)
console.log('Picked', theMeme)


// Upload the meme to Slack
await postSlackMeme(sentPath)
```

- [ ] **Step 2: Update `reddit-job/index.js`**

In `reddit-job/index.js`, delete the `HOST_URL` guard block (the migration removes `HOST_URL` entirely):

```js
  if (!process.env.HOST_URL) {
    console.error('HOST_URL not set; cannot build a public image url')
    process.exit(1)
  }
```

Then change the post call from the URL form to the local-path form. Replace:

```js
    await postSlackMeme(process.env.HOST_URL + 'already-sent/' + filename, {
      title: winner.title,
      url: redditUrl,
    })
```

with:

```js
    await postSlackMeme(path.join(ALREADY_SENT, filename), {
      title: winner.title,
      url: redditUrl,
    })
```

(`path` and `ALREADY_SENT` are already imported/defined at the top of the file.)

- [ ] **Step 3: Run the full test suites to confirm nothing broke**

Run: `cd job && bun test` then `cd ../reddit-job && bun test`
Expected: PASS. The reddit-job tests cover `select`, `schedule`, `slug` (pure modules) and don't import the changed call site, so they stay green.

- [ ] **Step 4: Commit**

```bash
git add job/meme-poster.js reddit-job/index.js
git commit -m "Pass local file path to postSlackMeme in both jobs"
```

---

## Task 3: Simplify compose + env (drop the file server)

**Files:**
- Modify: `docker-compose.yaml`
- Modify: `.env.sample`

- [ ] **Step 1: Rewrite `docker-compose.yaml` to a single service**

Replace the entire contents of `docker-compose.yaml` with:

```yaml
services:
  cron_job:
    container_name: meme-job
    image: meme-job
    build: .
    restart: ${RESTART_POLICY}
    volumes:
      - ${MEMES_DIR}:/memes
    environment:
      SLACK_BOT_TOKEN: ${SLACK_BOT_TOKEN}
      SLACK_CHANNEL_ID: ${SLACK_CHANNEL_ID}
      POST_MEME_ON_STARTUP: ${POST_MEME_ON_STARTUP}
      POST_CRON: ${POST_CRON}
      REDDIT_SUBREDDIT: ${REDDIT_SUBREDDIT}
      REDDIT_POST_CRON: ${REDDIT_POST_CRON}
      REDDIT_POST_ON_STARTUP: ${REDDIT_POST_ON_STARTUP}
      TZ: ${TZ}
```

(`file_server` service, `depends_on`, and the obsolete `version:` key are removed.)

- [ ] **Step 2: Rewrite `.env.sample`**

Replace the entire contents of `.env.sample` with:

```sh
COMPOSE_PROJECT_NAME=meme-poster

# meme-poster configuration:
# cp .env.sample .env

# Options: no | on-failure[:max-retries] | always | unless-stopped
RESTART_POLICY=always

# If you do not want to wait to see it in action ;)
POST_MEME_ON_STARTUP=

# When to post the meme!
# Confused? See: https://crontab.guru/
# Default: Every friday at 16h
TZ=Europe/Brussels
POST_CRON=0 16 * * fri

# Host folder holding the memes. On Coolify this is the NFS-mounted Dropbox path,
# e.g. /mnt/dropbox/Archive/Funny/Programming (prod) or .../Programming_dev-test (dev).
MEMES_DIR=./memes

# Reddit meme job (disabled by default — leave REDDIT_SUBREDDIT empty to skip it):
REDDIT_SUBREDDIT=
REDDIT_POST_CRON=0 9 * * mon
REDDIT_POST_ON_STARTUP=

#########
# Slack #
#########
# Bot User OAuth Token (xoxb-...) and target channel ID. See CreateSlackBot.md.
SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=
```

(`HOST_URL`, `FILE_SERVER_PORT`, `SLACK_WEBHOOK`, and the Discord block are removed.)

- [ ] **Step 3: Verify nothing else references the removed vars**

Run: `git grep -nE 'HOST_URL|FILE_SERVER_PORT|SLACK_WEBHOOK|file_server' -- . ':!docs' ':!*.md'`
Expected: no output (all references gone from code/compose).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yaml .env.sample
git commit -m "Drop file server; single cron service with NFS memes bind"
```

---

## Task 4: Update README + create the `dev` branch

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README setup/intro**

In `README.md`, replace the line:

```
`halverneus/static-file-server` is used to publicly share the `memes` folder for Slack to download.
```

with:

```
A Slack bot uploads each image directly (`files.uploadV2`) — no public file server needed.
```

And in the TODO list, remove the now-done item:

```
- Use Slack Bot Token (with files:write and chat:write) instead (for video support)
  - Use files.uploadV2 or files.getUploadURLExternal + files.completeUploadExternal
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Docs: bot upload replaces the public file server"
```

- [ ] **Step 3: Push `main` and create the `dev` branch**

> Procedural (not TDD). Confirm with the user before pushing — this is the `itenium-be` org repo.

```bash
git push origin main
git branch dev && git push -u origin dev
```

Expected: `dev` exists on `origin`, branched from the migrated `main`.

---

## Task 5: Add the org→GitHub-App registry (Home repo)

> All Home-repo tasks run from `/mnt/c/Users/woute/Dropbox/Personal/Programming/UnixCode/_personal/Home`.

**Files:**
- Modify: `homelab/coolify/target.ts`
- Modify: `homelab/coolify/plan.ts`
- Test: `homelab/coolify/plan.test.ts`

`createPayload` currently uses a single `t.githubAppUuid`. Change `Target` to carry a `githubApps` map (GitHub org → Coolify GitHub App uuid) and derive the app from the repo's org prefix.

- [ ] **Step 1: Write the failing test**

In `homelab/coolify/plan.test.ts`, update the `T` fixture's GitHub field and add a derivation test. Change the `T` constant to:

```ts
const T: Target = {
  apiBase: "http://x/api/v1",
  serverUuid: "srv",
  destinationUuid: "dst",
  githubApps: { SanguPackage: "gh-sangu", "itenium-be": "gh-itenium" },
};
```

Then add (inside the existing `describe("createPayload", …)` block, or a new `describe`):

```ts
test("createPayload derives github_app_uuid from the repo org", () => {
  const [prod] = resourcesFor(tribalwars);
  expect(createPayload(prod, T, P).github_app_uuid).toBe("gh-sangu");
});

test("createPayload throws for an org with no registered GitHub App", () => {
  const orphan: AppSpec = { repo: "other-org/thing", domain: "thing.sangu.be", auth: "public" };
  const [prod] = resourcesFor(orphan);
  expect(() => createPayload(prod, T, P)).toThrow(/no GitHub App registered for org other-org/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd homelab/coolify && bun test plan.test.ts`
Expected: FAIL — `Target` has no `githubApps` (type error) / `createPayload` still reads `githubAppUuid`.

- [ ] **Step 3: Update the `Target` type and value in `target.ts`**

In `homelab/coolify/target.ts`, change the `Target` type field:

```ts
export type Target = {
  apiBase: string;
  serverUuid: string;
  destinationUuid: string;
  githubApps: Record<string, string>; // GitHub org → Coolify GitHub App uuid
};
```

And the exported `target` value's GitHub field:

```ts
  githubApps: {
    SanguPackage: "hzgrn8osrrvwbqnl8ipd1k2t", // coolify-sangu-package (SanguPackage org)
    // "itenium-be": filled in Task 9 after installing the Coolify GitHub App on the org.
  },
```

- [ ] **Step 4: Derive the GitHub App in `plan.ts`**

In `homelab/coolify/plan.ts`, inside `createPayload`, replace `github_app_uuid: t.githubAppUuid,` with a derived lookup. Change the function body so it starts:

```ts
export function createPayload(r: Resource, t: Target, p: Placement): Record<string, unknown> {
  const org = r.app.repo.split("/")[0]!;
  const githubAppUuid = t.githubApps[org];
  if (!githubAppUuid) throw new Error(`no GitHub App registered for org ${org} (target.ts githubApps)`);
  return {
    project_uuid: p.projectUuid,
    server_uuid: t.serverUuid,
    environment_name: p.environmentName,
    environment_uuid: p.environmentUuid,
    github_app_uuid: githubAppUuid,
    destination_uuid: t.destinationUuid,
    git_repository: r.app.repo,
    git_branch: r.branch,
    is_auto_deploy_enabled: autoDeployOf(r.app),
    instant_deploy: false, // deploy explicitly after config is asserted
    ...buildFields(r),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd homelab/coolify && bun test plan.test.ts`
Expected: PASS (derivation + throw tests green; existing tests still green).

- [ ] **Step 6: Commit**

```bash
git add homelab/coolify/target.ts homelab/coolify/plan.ts homelab/coolify/plan.test.ts
git commit -m "feat(coolify): derive GitHub App from repo org (per-org registry)"
```

---

## Task 6: Support domain-less worker apps (Home repo)

**Files:**
- Modify: `homelab/coolify/coolify-apps.ts`
- Modify: `homelab/coolify/plan.ts`
- Test: `homelab/coolify/plan.test.ts`

A worker has no `domain`: no HTTP route, no port, no preview/auth. `resourcesFor` yields prod/dev on the `main`/`dev` branches with `domain: undefined` (no `dev-` prefix); `buildFields`/`diffResource` skip all domain fields; `projectName` falls back to the repo name; `manualSteps` emits nothing.

- [ ] **Step 1: Write the failing tests**

In `homelab/coolify/plan.test.ts` add a worker fixture and tests:

```ts
const worker: AppSpec = {
  repo: "itenium-be/slack-meme-poster",
  dev: true,
  build: { pack: "dockercompose", service: "cron_job", composeLocation: "/docker-compose.yaml" },
};

describe("domain-less worker", () => {
  test("resourcesFor yields main+dev with no domain and no dev- prefix", () => {
    const rs = resourcesFor(worker);
    expect(rs.map((r) => [r.tier, r.branch, r.domain])).toEqual([
      ["prod", "main", undefined],
      ["dev", "dev", undefined],
    ]);
  });

  test("projectName falls back to the repo name when no domain", () => {
    expect(projectName(worker)).toBe("slack-meme-poster");
  });

  test("createPayload omits domain/port fields for a worker", () => {
    const [prod] = resourcesFor(worker);
    const p = createPayload(prod, T, P);
    expect(p.build_pack).toBe("dockercompose");
    expect(p.docker_compose_location).toBe("/docker-compose.yaml");
    expect(p.docker_compose_domains).toBeUndefined();
    expect(p.domains).toBeUndefined();
    expect(p.ports_exposes).toBeUndefined();
  });

  test("diffResource ignores domain fields for a worker", () => {
    const [prod] = resourcesFor(worker);
    const inSync = { git_branch: "main", build_pack: "dockercompose", docker_compose_location: "/docker-compose.yaml" };
    expect(diffResource(prod, inSync)).toEqual([]);
  });

  test("manualSteps is empty for a worker", () => {
    expect(manualSteps(worker)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd homelab/coolify && bun test plan.test.ts`
Expected: FAIL — `AppSpec` requires `domain`/`auth`; `resourcesFor`/`buildFields`/`projectName` assume a domain.

- [ ] **Step 3: Make `domain` and `auth` optional in `coolify-apps.ts`**

In `homelab/coolify/coolify-apps.ts`, change the `AppSpec` type fields:

```ts
  repo: string; // "owner/repo" on GitHub
  domain?: string; // omit for a domain-less worker (cron/background); flat "x.sangu.be"=public | "x.lan.sangu.be"=internal
  project?: string; // Coolify project; defaults to the domain's first label, or the repo name for a worker
  dev?: boolean; // also deploy the `dev` branch → dev-x.sangu.be (worker: just a dev-branch resource, no domain)
  previews?: boolean;
  autoDeploy?: boolean;
  auth?: Auth; // required for routed apps; omit for a worker (no route to gate)
```

(Change `domain: string` → `domain?: string` and `auth: Auth` → `auth?: Auth`; update the two comments as shown.)

- [ ] **Step 4: Handle the no-domain case in `plan.ts`**

In `homelab/coolify/plan.ts`:

(a) `projectName` — fall back to the repo name when there's no domain:

```ts
export const projectName = (app: AppSpec): string =>
  app.project ?? (app.domain ? app.domain.split(".")[0]! : app.repo.split("/")[1]!);
```

(b) `Resource.domain` — make it optional:

```ts
export type Resource = {
  tier: Tier;
  branch: string;
  domain?: string; // undefined for a domain-less worker
  app: AppSpec;
};
```

(c) `resourcesFor` — no `dev-` prefix when there's no domain:

```ts
export function resourcesFor(app: AppSpec): Resource[] {
  const resources: Resource[] = [{ tier: "prod", branch: "main", domain: app.domain, app }];
  if (app.dev) {
    resources.push({ tier: "dev", branch: "dev", domain: app.domain ? devDomain(app.domain) : undefined, app });
  }
  return resources;
}
```

(d) `buildFields` — when no domain, emit only the build-pack/location (no routing):

```ts
function buildFields(r: Resource): Record<string, unknown> {
  const build = buildOf(r.app);
  if (build.pack === "dockercompose") {
    return {
      build_pack: "dockercompose",
      docker_compose_location: build.composeLocation ?? "/docker-compose.yaml",
      // compose apps bind the domain to a named service; a worker has no domain to bind.
      ...(r.domain ? { docker_compose_domains: [{ name: build.service, domain: fqdn(r.domain) }] } : {}),
    };
  }
  return {
    build_pack: "dockerfile",
    ...(r.domain ? { domains: fqdn(r.domain), ports_exposes: String(build.port ?? 80) } : {}),
    ...(build.dockerfileLocation ? { dockerfile_location: build.dockerfileLocation } : {}),
  };
}
```

(e) `diffResource` — skip domain/port comparisons when there's no domain. Inside `diffResource`, replace everything from `const build = buildOf(r.app);` through `return diffs;` (the `diffs`/`cmp` declarations above it stay) with:

```ts
  const build = buildOf(r.app);
  cmp("git_branch", current.git_branch, r.branch);
  cmp("build_pack", current.build_pack, build.pack);
  if (build.pack === "dockercompose") {
    cmp("docker_compose_location", current.docker_compose_location, build.composeLocation ?? "/compose.yaml");
    if (r.domain) {
      const got = composeDomain(current.docker_compose_domains, build.service);
      cmp(`compose_domain[${build.service}]`, got, fqdn(r.domain));
    }
  } else if (r.domain) {
    if (!fqdnHas(current.fqdn, fqdn(r.domain))) {
      diffs.push({ field: "fqdn", from: current.fqdn || "(unset)", to: fqdn(r.domain) });
    }
    cmp("ports_exposes", current.ports_exposes, String(build.port ?? 80));
  }
  return diffs;
```

(f) `manualSteps` — guard the auth branch on a domain (no route → nothing to gate):

```ts
  if (app.domain && app.auth && app.auth !== "public") {
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd homelab/coolify && bun test plan.test.ts`
Expected: PASS — worker tests green, all prior tests still green.

- [ ] **Step 6: Commit**

```bash
git add homelab/coolify/coolify-apps.ts homelab/coolify/plan.ts homelab/coolify/plan.test.ts
git commit -m "feat(coolify): support domain-less worker apps in the manifest"
```

---

## Task 7: Add the manifest entry (Home repo)

**Files:**
- Modify: `homelab/coolify/coolify-apps.ts`

- [ ] **Step 1: Append the worker entry to the `apps` array**

In `homelab/coolify/coolify-apps.ts`, add to the `apps` array:

```ts
  {
    // Domain-less cron worker: posts a weekly meme to Slack via a bot (no HTTP route).
    // prod=main→itenium, dev=dev→pongit. Secrets + per-tier MEMES_DIR/POST_CRON are set
    // per-resource in the Coolify UI (manifest stays infra-only). GitHub App for the
    // itenium-be org must be registered in target.ts (Task 9).
    repo: "itenium-be/slack-meme-poster",
    dev: true,
    build: { pack: "dockercompose", service: "cron_job", composeLocation: "/docker-compose.yaml" },
  },
```

- [ ] **Step 2: Type-check the manifest**

Run: `cd homelab/coolify && bun run tsc --noEmit` (or `bunx tsc --noEmit` if no `tsc` script)
Expected: no type errors (the entry is valid now that `domain`/`auth` are optional).

- [ ] **Step 3: Dry-run the sync to preview the plan (no changes)**

> Requires `homelab/coolify/.env` with `COOLIFY_TOKEN`; run where the Coolify API is reachable (apps-01 / LAN). If not reachable from here, defer this step to Task 9.

Run: `cd homelab/coolify && bun sync.ts --dry-run`
Expected: prints `+ CREATE itenium-be/slack-meme-poster@main` and `…@dev`; **no** "must be set by hand" warnings for this app (worker → no previews/auth).

- [ ] **Step 4: Commit**

```bash
git add homelab/coolify/coolify-apps.ts
git commit -m "feat(coolify): add slack-meme-poster worker (prod+dev)"
```

---

## Task 8: Document the NFS mount + one-time deploy steps (Home repo)

**Files:**
- Modify: `homelab/docs/runbooks/11-coolify.md`

- [ ] **Step 1: Add a "memes / Dropbox NFS mount" subsection**

Append a new section to `homelab/docs/runbooks/11-coolify.md` (after §7, before §8 Validation):

```markdown
## 7a. Dropbox NFS mount (for apps that read NAS files)

Some apps (e.g. `slack-meme-poster`) read files from Dropbox on `nas-work`
(`10.0.20.10`). Mount the Dropbox root once on apps-01; each app's compose binds
only the subpath it needs (so a container sees just its slice).

1. **Synology `nas-work` UI:** Control Panel → File Services → enable **NFS**.
   Then Shared Folder → the Dropbox share → **NFS Permissions** → add a rule for
   `10.0.20.30` (apps-01), read/write, `squash = no mapping`, `security = sys`.
2. **apps-01 host** — add the mount to `/etc/fstab` and mount it:

   ```sh
   ssh wouter@10.0.20.30
   sudo mkdir -p /mnt/dropbox
   echo '10.0.20.10:/volume1/Dropbox /mnt/dropbox nfs defaults,nofail,_netdev,vers=4.1 0 0' | sudo tee -a /etc/fstab
   sudo mount /mnt/dropbox
   ls /mnt/dropbox            # should list the Dropbox tree
   ```

   `nofail,_netdev` keep apps-01 booting if the NAS is briefly unavailable.
3. Per app, set `MEMES_DIR` (in the Coolify resource env) to the subpath, e.g.
   `/mnt/dropbox/Archive/Funny/Programming` (prod) and the `_dev-test` folder (dev).
   The app's compose binds `${MEMES_DIR}:/memes`.
```

- [ ] **Step 2: Commit**

```bash
git add homelab/docs/runbooks/11-coolify.md
git commit -m "docs(coolify): Dropbox NFS mount for NAS-file apps"
```

---

## Task 9: One-time deploy wiring (manual, documented)

> Procedural — not TDD. Do these in order; then the app auto-deploys on every push.

- [ ] **Step 1: NFS mount** — do Task 8's §7a steps on `nas-work` + apps-01. Verify `ls /mnt/dropbox/Archive/Funny/Programming` shows memes, and create the dev folder `…/Archive/Funny/Programming_dev-test` (drop a few test memes in it).

- [ ] **Step 2: Coolify GitHub App for `itenium-be`** — Coolify → *Sources* → GitHub → create a new GitHub App and **install it on the `itenium-be` org** (grant the `slack-meme-poster` repo). Then capture its uuid and put it in `target.ts`:

   ```sh
   # from apps-01 or the LAN, with COOLIFY_TOKEN set:
   curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" http://10.0.20.30:8000/api/v1/github-apps | jq '.[] | {name, uuid}'
   ```

   Add the `itenium-be` line to `homelab/coolify/target.ts` `githubApps`, then commit + push:

   ```ts
     githubApps: {
       SanguPackage: "hzgrn8osrrvwbqnl8ipd1k2t",
       "itenium-be": "<uuid-from-curl>",
     },
   ```

   ```bash
   git add homelab/coolify/target.ts
   git commit -m "feat(coolify): register itenium-be GitHub App uuid"
   git push
   ```

- [ ] **Step 3: Create the two Slack bots** — follow `CreateSlackBot.md` once per workspace (itenium + pongit): scopes `chat:write` + `files:write`, install, invite the bot to the target channel, grab the `xoxb-…` token and the channel ID.

- [ ] **Step 4: Sync (creates the prod + dev resources)** — on apps-01 (or via `homelab/deploy.sh`):

   ```sh
   cd homelab/coolify && bun sync.ts --dry-run   # confirm CREATE main + dev
   bun sync.ts                                    # create resources (no deploy yet)
   ```

- [ ] **Step 5: Set per-resource env in the Coolify UI** — for each resource (prod, dev), add:

   | Var               | prod (main → itenium)                       | dev (dev → pongit)                                |
   |-------------------|---------------------------------------------|---------------------------------------------------|
   | `SLACK_BOT_TOKEN` | itenium `xoxb-…` (secret)                   | pongit `xoxb-…` (secret)                          |
   | `SLACK_CHANNEL_ID`| itenium channel id                          | pongit channel id                                 |
   | `MEMES_DIR`       | `/mnt/dropbox/Archive/Funny/Programming`    | `/mnt/dropbox/Archive/Funny/Programming_dev-test` |
   | `POST_CRON`       | `0 16 * * fri`                              | `0 16 1 1 *` (≈yearly; test via on-startup)       |
   | `TZ`              | `Europe/Brussels`                           | `Europe/Brussels`                                 |
   | `RESTART_POLICY`  | `unless-stopped`                            | `unless-stopped`                                  |

   For a quick first test on **dev**, also set `POST_MEME_ON_STARTUP=1`, deploy, confirm a meme lands in the pongit channel and moved to `already-sent/`, then clear it.

- [ ] **Step 6: Deploy** — in Coolify, deploy both resources (or `bun sync.ts --deploy`). Verify in the resource logs that `crond` is scheduled and (dev) the startup post succeeded.

---

## Self-review notes

- **Spec coverage:** bot migration (T1–T2), file-server removal + compose/env (T3), README (T4), dev branch (T4), org→GitHub-App registry (T5), domain-less worker tooling (T6), manifest entry (T7), NFS mount doc (T8), one-time wiring incl. Slack bots + secrets + per-tier MEMES_DIR/POST_CRON (T9). Reddit stays present-but-disabled (`REDDIT_SUBREDDIT` empty in `.env.sample` + compose passes it through). All spec sections map to a task.
- **`MEMES_DIR` vs `MEMES_HOST_DIR`:** the plan reuses the existing `MEMES_DIR` compose var instead of the spec's `MEMES_HOST_DIR` (same role, less churn).
- **Naming consistency:** `buildComment`, `postSlackMeme(filePath, meta)`, `githubApps`, `MEMES_DIR` used identically across tasks.
```
