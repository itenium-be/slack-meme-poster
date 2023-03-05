import fetch from 'node-fetch'

const webhookUrl = process.env.SLACK_WEBHOOK
// console.log(`Using webhook: ${webhookUrl}`)

// Configure your message via
// https://app.slack.com/block-kit-builder/

console.log('About to post a meme!')
const imageUrl = process.env.HOST_URL + 'cat.jpg'
console.log(imageUrl)

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
          text: 'Kitten',
          emoji: true
        },
        // image_url: 'https://pbs.twimg.com/profile_images/625633822235693056/lNGUneLX_400x400.jpg',
        image_url: imageUrl,
        alt_text: 'Cute cat'
      }
    ]
  }),
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})
