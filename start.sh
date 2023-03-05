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
CRON_CMD="${POST_CRON} node /usr/scheduler/job/slack-meme-poster.js"
echo "$CRON_CMD" > crontab.txt

crontab crontab.txt
crond -f
