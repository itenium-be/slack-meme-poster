import fetch from 'node-fetch'

const webhookUrl = process.env.SLACK_WEBHOOK
// console.log(`Using webhook: ${webhookUrl}`)

// Configure your message via
// https://app.slack.com/block-kit-builder/

export async function postMeme(imageUrl) {
  const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1)

  console.log('About to post meme:', fileName)
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
            text: 'fileName',
            emoji: true
          },
          // image_url: 'https://pbs.twimg.com/profile_images/625633822235693056/lNGUneLX_400x400.jpg',
          image_url: imageUrl,
          alt_text: fileName
        }
      ]
    }),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
}
