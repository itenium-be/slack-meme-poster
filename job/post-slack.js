import fetch from 'node-fetch'

// Configure messages via https://app.slack.com/block-kit-builder/

export const HEADERS = [
  'git commit -m "meme" ✅',
  "Stop the build — it's meme o'clock 🕒",
  'Fresh meme incoming! 🚀',
  'A wild meme appeared! ✨',
  'Hot off the press 📰',
  'sudo deliver-meme --force ⚡',
  'Merging meme into main… ✅',
  'It compiled. Send meme. 📤',
  'cat /dev/memes 🐱',
  'Rollback canceled — meme detected 🎯',
  'One does not simply skip the meme 🧙‍♂️',
  'A wild *new* meme appeared! ✨',
  "99 problems, this meme isn't one 🎵",
  "It's dangerous to go alone — take this meme 🗡️",
  'Behold 👀',
  '🥁 *drumroll* 🥁',
  'Brace for impact! 💥',
  'O(1) meme delivery ⚡',
  'Refactored: now with 100% more meme 💯',
  'Patch notes: +1 meme 🩹',
  'Build passed: deploying meme 🟢',
  'Trained on memes since 2007 📚',
  'Powered by caffeine and despair ☕🖤',
  "This meeting could've been a meme 📅",
]

export function pickHeader() {
  return HEADERS[Math.floor(Math.random() * HEADERS.length)]
}

// Reddit titles can contain `<`, `>`, `&`, which would break the <url|text>
// link syntax of Slack mrkdwn. Escape them, leave everything else alone.
export function escapeMrkdwn(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function buildMemeBlocks(imageUrl, headerText, meta) {
  const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerText },
    },
  ]
  if (meta) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        // meta.url is not escaped: Reddit canonical URLs never contain `|` or `>`.
        text: `🔗 *<${meta.url}|${escapeMrkdwn(meta.title)}>*`,
      },
    })
  }
  blocks.push({
    type: 'image',
    title: { type: 'plain_text', text: fileName, emoji: true },
    image_url: imageUrl,
    alt_text: fileName,
  })
  return blocks
}

const webhookUrl = process.env.SLACK_WEBHOOK

export async function postSlackMeme(imageUrl, meta) {
  const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1)
  console.log('About to post meme:', fileName)
  console.log('Full url:', imageUrl)

  await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify({ blocks: buildMemeBlocks(imageUrl, pickHeader(), meta) }),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
}
