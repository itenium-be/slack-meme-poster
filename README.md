Random Meme Poster
==================

Cron job to post a randomly selected meme (any picture really) to Slack.  
Images are moved to `already-sent` to avoid duplicate posting.


```sh
# Configure your Slack bot token + channel (see CreateSlackBot.md)
cp .env.sample .env

# Schedule meme-posting!
docker-compose up --build -d
```

## Reddit meme job

A second, opt-in cron job posts the top-upvoted from a subreddit,
covering everything posted since its previous run. Configure in `.env`.


## Output

![Example Slack output](example-slack-post.png "Example Slack output")


## Resources

- [Cron Docker Blog post](https://levelup.gitconnected.com/cron-docker-the-easiest-job-scheduler-youll-ever-create-e1753eb5ea44)
  - [Source Code](https://github.com/erikbrgr/scheduler)
