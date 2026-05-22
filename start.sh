#!/bin/bash

echo "Node: $(node -v)"


cd ./job
npm install
if [ "$POST_MEME_ON_STARTUP" ]; then
  npm start
fi
cd ../


cd ./reddit-job
npm install
if [ "$REDDIT_POST_ON_STARTUP" ]; then
  npm start
fi
cd ../


# POST_CRON='0 16 * * fri'
echo "Scheduling posting at: ${POST_CRON}"
echo "${POST_CRON} node /usr/scheduler/job/meme-poster.js" > crontab.txt

# Only schedule the Reddit job when a subreddit is configured.
if [ "$REDDIT_SUBREDDIT" ]; then
  echo "Scheduling Reddit posting at: ${REDDIT_POST_CRON}"
  echo "${REDDIT_POST_CRON} node /usr/scheduler/reddit-job/index.js" >> crontab.txt
fi

crontab crontab.txt
crond -f
