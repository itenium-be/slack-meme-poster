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
