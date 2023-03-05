Random Slack Meme
=================

Cron job to post a randomly selected meme (any picture really) to Slack through their webhook.  
Images are moved to `already-sent` to avoid duplicate posting.
`halverneus/static-file-server` is used to publicly share the `memes` folder for Slack to download.


```sh
# Configure Slack webhook etc
cp .env.sample .env

# Schedule meme-posting!
docker-compose up --build -d
```


With default settings, `server:4001/cat.jpg` should pop up!
Or change permissions if you get Forbidden: `chmod -R 755 memes`



Configuration
-------------

Example `.env` config:

```ini
COMPOSE_PROJECT_NAME=slack-meme-poster

# Options: no | on-failure[:max-retries] | always | unless-stopped
RESTART_POLICY=always

# If you do not want to wait to see it in action ;)
POST_MEME_ON_STARTUP=

# Full Slack web hook url
# Ala: https://hooks.slack.com/services/SomeCode/AnotherCode/EvenLongerCode
# See: https://api.slack.com/apps?new_app=1
SLACK_WEBHOOK=

# When to post the meme!
# Confused? See: https://crontab.guru/
# Default: Every friday at 16h
POST_CRON=0 16 * * fri

# ...and where to find them
# Put some image files in there!
MEMES_DIR=./memes

# Need public hosting for the memes so Slack can download it
HOST_URL=http://itenium.synology.me:4001/
FILE_SERVER_PORT=4001
```


Output
------

![Example Slack output](example-slack-post.png "Example Slack output")
