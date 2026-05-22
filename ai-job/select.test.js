import { test, expect } from 'bun:test'
import { isImagePost, pickMeme } from './select.js'

const SINCE = new Date('2025-05-15T00:00:00Z') // epoch s = 1747267200
const after = 1747353600  // 2025-05-16
const before = 1747180800 // 2025-05-14

const img = (over) => ({ id: 'a', title: 't', score: 10, url: 'https://i.redd.it/a.jpg', createdUtc: after, postHint: 'image', isVideo: false, over18: false, ...over })

test('isImagePost: true for image post_hint', () => {
  expect(isImagePost(img())).toBe(true)
})

test('isImagePost: true when url ends in image extension', () => {
  expect(isImagePost(img({ postHint: undefined, url: 'https://x/y.PNG' }))).toBe(true)
})

test('isImagePost: false for video', () => {
  expect(isImagePost(img({ isVideo: true }))).toBe(false)
})

test('isImagePost: false for nsfw', () => {
  expect(isImagePost(img({ over18: true }))).toBe(false)
})

test('isImagePost: false for non-image link', () => {
  expect(isImagePost(img({ postHint: 'link', url: 'https://example.com/page' }))).toBe(false)
})

test('pickMeme: returns highest score among eligible images', () => {
  const posts = [
    img({ id: 'low', score: 5 }),
    img({ id: 'high', score: 99 }),
    img({ id: 'vid', score: 500, isVideo: true }),
  ]
  expect(pickMeme(posts, SINCE).id).toBe('high')
})

test('pickMeme: excludes posts created on/before sinceUtc', () => {
  const posts = [img({ id: 'old', score: 99, createdUtc: before })]
  expect(pickMeme(posts, SINCE)).toBe(null)
})

test('pickMeme: returns null when nothing qualifies', () => {
  expect(pickMeme([img({ isVideo: true })], SINCE)).toBe(null)
})

test('pickMeme: excludes post created exactly at sinceUtc (strict >)', () => {
  const posts = [img({ id: 'boundary', score: 99, createdUtc: 1747267200 })]
  expect(pickMeme(posts, SINCE)).toBe(null)
})
