// gif is intentionally allowed: Slack image blocks render animated gifs fine
import type { RedditPost } from './reddit'

const IMAGE_RE = /\.(jpe?g|png|gif)$/i

export function isImagePost(post: RedditPost): boolean {
  const isImage = post.postHint === 'image' || IMAGE_RE.test(post.url)
  return isImage && !post.isVideo && !post.over18
}

export function pickMeme(posts: RedditPost[], sinceUtc: Date): RedditPost | null {
  const sinceSeconds = sinceUtc.getTime() / 1000
  const eligible = posts.filter(
    (p) => isImagePost(p) && p.createdUtc > sinceSeconds
  )
  if (eligible.length === 0) return null
  return eligible.reduce((best, p) => (p.score > best.score ? p : best))
}
