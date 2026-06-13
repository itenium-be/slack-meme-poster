#!/bin/bash

echo "Bun: $(bun --version)"
BUN="$(command -v bun)"

# Load committed non-secret config for this tier. TIER (dev|prod) + the secret
# SLACK_BOT_TOKEN come from the container env (set per Coolify resource). We source
# the file ourselves rather than rely on compose `env_file`, which Coolify doesn't
# honor for repo files. `set -a` exports everything so cron-fired jobs inherit it too.
if [ -f "./deploy/${TIER}.env" ]; then
  echo "Loading config: deploy/${TIER}.env"
  set -a
  . "./deploy/${TIER}.env"
  set +a
else
  echo "WARNING: deploy/${TIER}.env not found (TIER='${TIER}') — no config loaded"
fi


cd ./job
bun install
if [ "$POST_MEME_ON_STARTUP" ]; then
  bun run start
fi
cd ../


cd ./reddit-job
bun install
if [ "$REDDIT_POST_ON_STARTUP" ]; then
  bun run start
fi
cd ../


# POST_CRON='0 16 * * fri'
echo "Scheduling posting at: ${POST_CRON}"
echo "${POST_CRON} ${BUN} /usr/scheduler/job/meme-poster.ts" > crontab.txt

# Only schedule the Reddit job when a subreddit is configured.
if [ "$REDDIT_SUBREDDIT" ]; then
  echo "Scheduling Reddit posting at: ${REDDIT_POST_CRON}"
  echo "${REDDIT_POST_CRON} ${BUN} /usr/scheduler/reddit-job/index.ts" >> crontab.txt
fi

crontab crontab.txt
crond -f
