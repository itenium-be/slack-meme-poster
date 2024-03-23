import fetch from 'node-fetch'

const currentDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
const messageToPostWithMeme = `${currentDayName} vibes, everyone! 😎`


const webhookUrl = process.env.SLACK_WEBHOOK
// console.log(`Using webhook: ${webhookUrl}`)


// Configure your message via (super handy!)
// https://app.slack.com/block-kit-builder/


export async function postSlackMeme(imageUrl) {
  const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
  console.log('About to post meme:', fileName)
  console.log('Full url:', imageUrl);

  await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: messageToPostWithMeme
          }
        },
        {
          type: 'image',
          title: {
            type: 'plain_text',
            text: fileName,
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
