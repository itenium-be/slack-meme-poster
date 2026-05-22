// gif is intentionally allowed: Slack image blocks render animated gifs fine
const IMAGE_RE = /\.(jpe?g|png|gif)$/i

export function isImagePost(post) {
  const isImage = post.postHint === 'image' || IMAGE_RE.test(post.url)
  return isImage && !post.isVideo && !post.over18
}

export function pickMeme(posts, sinceUtc) {
  const sinceSeconds = sinceUtc.getTime() / 1000
  const eligible = posts.filter(
    (p) => isImagePost(p) && p.createdUtc > sinceSeconds
  )
  if (eligible.length === 0) return null
  return eligible.reduce((best, p) => (p.score > best.score ? p : best))
}
