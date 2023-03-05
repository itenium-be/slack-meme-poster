#!/bin/bash

echo "Node: $(node -v)"


cd ./job
npm install
if [ "$POST_MEME_ON_STARTUP" ]; then
  npm start
fi
cd ../


crontab crontab.txt
crond -f
