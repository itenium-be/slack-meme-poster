Random Meme Poster
==================

Node v16.

Cron job to post a randomly selected meme (any picture really) to a messaging app.  
Images are moved to `already-sent` to avoid duplicate posting.
`halverneus/static-file-server` is used to publicly share the `memes` folder for Slack to download.

Supported: Slack, Discord.


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


## Output

![Example Slack output](example-slack-post.png "Example Slack output")


## Resources

- [Ofelia](https://github.com/mcuadros/ofelia): A docker job scheduler (aka. crontab for docker)
- [Cron Docker Blog post](https://levelup.gitconnected.com/cron-docker-the-easiest-job-scheduler-youll-ever-create-e1753eb5ea44)
  - [Source Code](https://github.com/erikbrgr/scheduler)
