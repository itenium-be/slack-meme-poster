// ai-job/reddit.js
import fetch from 'node-fetch'

const USER_AGENT = 'slack-meme-poster/1.0'

function normalize(data) {
  return {
    id: data.id,
    title: data.title,
    score: data.score,
    url: data.url,
    createdUtc: data.created_utc,
    postHint: data.post_hint,
    isVideo: data.is_video,
    over18: data.over_18,
  }
}

export async function fetchTopPosts(subreddit, timeWindow) {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=${timeWindow}&limit=100`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(`Reddit returned ${res.status} for ${url}`)
  }
  const json = await res.json()
  // Reddit can answer 200 with an error body (e.g. {error: 403}); fail loudly.
  if (!json?.data?.children) {
    throw new Error(`Unexpected Reddit response body for ${url}`)
  }
  return json.data.children.map((c) => normalize(c.data))
}
