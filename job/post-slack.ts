import fs from 'fs'
import { WebClient } from '@slack/web-api'

// Configure messages via https://app.slack.com/block-kit-builder/

export interface Meta {
  title: string
  url: string
}

export const HEADERS: string[] = [
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

export function pickHeader(): string {
  return HEADERS[Math.floor(Math.random() * HEADERS.length)]
}

// Reddit titles can contain `<`, `>`, `&`, which would break the <url|text>
// link syntax of Slack mrkdwn. Escape them, leave everything else alone.
export function escapeMrkdwn(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// The text shown above the uploaded file (Slack `initial_comment`, mrkdwn).
// meta.url is not escaped: reddit canonical URLs never contain `|` or `>`.
export function buildComment(headerText: string, meta?: Meta): string {
  if (!meta) return headerText
  return `${headerText}\n🔗 *<${meta.url}|${escapeMrkdwn(meta.title)}>*`
}

const client = new WebClient(process.env.SLACK_BOT_TOKEN)
const channel = process.env.SLACK_CHANNEL_ID

export async function postSlackMeme(filePath: string, meta?: Meta): Promise<void> {
  const fileName = filePath.substring(filePath.lastIndexOf('/') + 1)
  console.log('About to upload meme:', fileName)

  await client.files.uploadV2({
    channel_id: channel!,
    file: fs.readFileSync(filePath),
    filename: fileName,
    initial_comment: buildComment(pickHeader(), meta),
  })
}
