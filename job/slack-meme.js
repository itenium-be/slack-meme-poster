import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()
const webhookUrl = process.env.SLACK_WEBHOOK

// Configure your message via
// https://app.slack.com/block-kit-builder/

await fetch(webhookUrl, {
  method: 'POST',
  body: JSON.stringify({
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: "It's friday my boys! :smile:"
        }
      },
      {
        type: 'image',
        title: {
          type: 'plain_text',
          text: 'Kittens',
          emoji: true
        },
        image_url: 'https://pbs.twimg.com/profile_images/625633822235693056/lNGUneLX_400x400.jpg',
        alt_text: 'Cute cats'
      }
    ]
  }),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})
