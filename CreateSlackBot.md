# Create the Slack Bot

Guide for setting up the Slack bot that will replace the incoming webhook. The
bot can post messages **and** upload files (so we can post images and videos
directly and retire the public file server).

This is a one-time setup. Once done, save `SLACK_BOT_TOKEN` and
`SLACK_CHANNEL_ID` in `.env`.

---

## 1. Create the app

1. Go to <https://api.slack.com/apps> → **Create New App** → **From scratch**.
2. App Name: `meme-poster` (or whatever you like).
3. Pick your workspace → **Create App**.

## 2. Add OAuth scopes

In the app config, go to **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**, add:

| Scope         | Why                                                         |
|---------------|-------------------------------------------------------------|
| `chat:write`  | Post messages to channels the bot is in.                    |
| `files:write` | Upload images and videos directly (`files.uploadV2`).        |

Optional but useful:

| Scope                | Why                                                            |
|----------------------|----------------------------------------------------------------|
| `channels:read`      | Look up channel IDs by name from the API.                       |
| `chat:write.customize` | Customise the bot's name/icon per post (not strictly needed).  |

## 3. Install to workspace

Back at the top of **OAuth & Permissions** → **Install to Workspace** → review and **Allow**.

After install, copy the **Bot User OAuth Token** (starts with `xoxb-…`). Save it
as `SLACK_BOT_TOKEN` in `.env` (**not** `.env.sample` — it's a secret).

## 4. Invite the bot to the channel

In Slack, open the target channel and run:

```
/invite @meme-poster
```

(Use whatever app name you chose.) The bot must be a member of every channel it
posts to.

## 5. Get the channel ID

Easiest way: in Slack, click the channel name → **About** → **Channel ID** at
the bottom (e.g. `C0123ABCD45`). Save it as `SLACK_CHANNEL_ID` in `.env`.

## 6. Env vars to add

When the migration lands, `.env` will need:

```sh
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0123ABCD45
```

You can keep `SLACK_WEBHOOK` set in parallel during cutover — it gets removed
once the bot path is verified working.

## Verifying the token (optional, before the migration)

```sh
curl -s -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test | jq
```

Expected: `"ok": true` plus the bot's identity. If `not_authed` /
`invalid_auth`, the token is wrong.

## Notes

- Tokens are workspace-scoped — one token only works in the workspace you
  installed the app to.
- If you ever rotate the token (Settings → **Basic Information** →
  **App-Level Tokens** / reinstall), just update `.env` and restart the
  container.
- The webhook URL (`SLACK_WEBHOOK`) can be deleted from Slack after the
  migration is in production.
