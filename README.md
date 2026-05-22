Random Meme Poster
==================

Node v16.

Cron job to post a randomly selected meme (any picture really) to a messaging app.  
Images are moved to `already-sent` to avoid duplicate posting.
`halverneus/static-file-server` is used to publicly share the `memes` folder for Slack to download.

Supported: Slack, Discord.


TODO:
- Use Slack Bot Token (with files:write and chat:write) instead (for video support)
  - Use files.uploadV2 or files.getUploadURLExternal + files.completeUploadExternal
- Implement Discord
- Also implement WhatsApp, ...
  - Use something that already supports all these integrations?
- ~~Scrape reddit/programmingHumour and pick the "best" meme from the last week~~ → see "AI meme job" below



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


## AI meme job

A second, opt-in cron job posts the top-upvoted still-image from a subreddit,
covering everything posted since its previous run. Configure in `.env`:

| Var                  | Meaning                                              |
|----------------------|------------------------------------------------------|
| `AI_SUBREDDIT`       | Subreddit to scrape. **Empty = job disabled.**       |
| `AI_POST_CRON`       | Cron schedule for the AI job.                         |
| `AI_POST_ON_STARTUP` | Non-empty to also post once on container start.       |

It downloads the winner as `YYYY-MM-DD.<ext>` into `memes/already-sent/` and
posts it through the same Slack webhook. Videos and galleries are skipped (see
the bot-token TODO for video support).


## Output

![Example Slack output](example-slack-post.png "Example Slack output")


## Resources

- [Ofelia](https://github.com/mcuadros/ofelia): A docker job scheduler (aka. crontab for docker)
- [Cron Docker Blog post](https://levelup.gitconnected.com/cron-docker-the-easiest-job-scheduler-youll-ever-create-e1753eb5ea44)
  - [Source Code](https://github.com/erikbrgr/scheduler)
