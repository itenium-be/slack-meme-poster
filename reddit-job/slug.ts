// reddit-job/slug.ts
const MAX_LEN = 50

export function slugify(title: string): string {
  const cleaned = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LEN)
    .replace(/-+$/g, '')
  return cleaned
}
