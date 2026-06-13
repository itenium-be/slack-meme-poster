Random Meme Poster
==================

Node v20.

Cron job to post a randomly selected meme (any picture really) to a messaging app.  
Images are moved to `already-sent` to avoid duplicate posting.
A Slack bot uploads each image directly (`files.uploadV2`) — no public file server needed.

Supported: Slack, Discord.


TODO:
- Implement Discord
- Also implement WhatsApp, ...
  - Use something that already supports all these integrations?



```sh
# Configure Slack webhook etc
cp .env.sample .env

# Schedule meme-posting!
docker-compose up --build -d
```


## Permissions

If you get a 403 Forbidden for `server:4001/cat.jpg`:

```sh
chmod -R 755 memes_folder
```


## Reddit meme job

A second, opt-in cron job posts the top-upvoted from a subreddit,
covering everything posted since its previous run. Configure in `.env`:


## Output

![Example Slack output](example-slack-post.png "Example Slack output")


## Resources

- [Ofelia](https://github.com/mcuadros/ofelia): A docker job scheduler (aka. crontab for docker)
- [Cron Docker Blog post](https://levelup.gitconnected.com/cron-docker-the-easiest-job-scheduler-youll-ever-create-e1753eb5ea44)
  - [Source Code](https://github.com/erikbrgr/scheduler)
