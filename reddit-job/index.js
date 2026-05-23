import fs from 'fs'
import path from 'path'
import { URL } from 'url'
import fetch from 'node-fetch'
import { fetchTopPosts } from './reddit.js'
import { pickMeme } from './select.js'
import { previousRun, redditWindow } from './schedule.js'
import { slugify } from './slug.js'
import { postSlackMeme } from '../job/post-slack.js'

const USER_AGENT = 'slack-meme-poster/1.0'
const ALREADY_SENT = '/memes/already-sent'

function targetFilename(imageUrl, now, title) {
  const ext = path.extname(new URL(imageUrl).pathname) || '.jpg'
  const date = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const slug = slugify(title)
  const base = slug ? `${date}-${slug}` : date
  let filename = `${base}${ext}`
  let n = 2
  while (fs.existsSync(path.join(ALREADY_SENT, filename))) {
    filename = `${base}-${n}${ext}`
    n++
  }
  return filename
}

async function downloadTo(imageUrl, destPath) {
  const res = await fetch(imageUrl, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Image download returned ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
}

async function main() {
  const subreddit = process.env.REDDIT_SUBREDDIT
  if (!subreddit) {
    console.error('REDDIT_SUBREDDIT not set; nothing to do')
    process.exit(1)
  }

  if (!process.env.HOST_URL) {
    console.error('HOST_URL not set; cannot build a public image url')
    process.exit(1)
  }

  const now = new Date()
  // TZ must match the cron's timezone so the window aligns with real fire times
  const since = previousRun(process.env.REDDIT_POST_CRON, now, process.env.TZ)
  const window = redditWindow(since, now)
  console.log(`r/${subreddit} top?t=${window} since ${since.toISOString()}`)

  let posts
  try {
    posts = await fetchTopPosts(subreddit, window)
  } catch (err) {
    console.error('Reddit fetch failed:', err.message)
    process.exit(1)
  }

  const winner = pickMeme(posts, since)
  if (!winner) {
    console.log('Nothing new to post')
    process.exit(0)
  }
  console.log(`Picked "${winner.title}" (${winner.score} upvotes): ${winner.url}`)

  const filename = targetFilename(winner.url, now, winner.title)
  try {
    await downloadTo(winner.url, path.join(ALREADY_SENT, filename))
  } catch (err) {
    console.error('Download failed:', err.message)
    process.exit(1)
  }

  const redditUrl = 'https://www.reddit.com' + winner.permalink
  try {
    await postSlackMeme(process.env.HOST_URL + 'already-sent/' + filename, {
      title: winner.title,
      url: redditUrl,
    })
  } catch (err) {
    console.error('Slack post failed:', err.message)
    process.exit(1)
  }
  console.log('Posted', filename)
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
