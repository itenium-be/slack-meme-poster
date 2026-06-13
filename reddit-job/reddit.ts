import fetch from 'node-fetch'

const USER_AGENT = 'slack-meme-poster/1.0'

export interface RedditPost {
  id: string
  title: string
  score: number
  url: string
  createdUtc: number
  postHint: string | undefined
  isVideo: boolean
  over18: boolean
  permalink: string
}

interface RawRedditPost {
  id: string
  title: string
  score: number
  url: string
  created_utc: number
  post_hint?: string
  is_video: boolean
  over_18: boolean
  permalink: string
}

interface RedditApiResponse {
  data?: {
    children?: Array<{ data: RawRedditPost }>
  }
}

function normalize(data: RawRedditPost): RedditPost {
  return {
    id: data.id,
    title: data.title,
    score: data.score,
    url: data.url,
    createdUtc: data.created_utc,
    postHint: data.post_hint,
    isVideo: data.is_video,
    over18: data.over_18,
    permalink: data.permalink,
  }
}

export async function fetchTopPosts(subreddit: string, timeWindow: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top.json?t=${timeWindow}&limit=100`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(`Reddit returned ${res.status} for ${url}`)
  }
  const json = await res.json() as RedditApiResponse
  // Reddit can answer 200 with an error body (e.g. {error: 403}); fail loudly.
  if (!json?.data?.children) {
    throw new Error(`Unexpected Reddit response body for ${url}`)
  }
  return json.data.children.map((c) => normalize(c.data))
}
