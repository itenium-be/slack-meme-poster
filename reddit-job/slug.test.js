import { test, expect } from 'bun:test'
import { slugify } from './slug.js'

test('slugify: normal title becomes lowercase kebab', () => {
  expect(slugify('When The Code Finally Works')).toBe('when-the-code-finally-works')
})

test('slugify: collapses punctuation and whitespace', () => {
  expect(slugify("Hello,  world!! It's me.")).toBe('hello-world-it-s-me')
})

test('slugify: trims leading and trailing separators', () => {
  expect(slugify('---weird---title---')).toBe('weird-title')
})

test('slugify: truncates to 50 chars and re-trims trailing dash', () => {
  // 60-char input where char 51 lands on a separator, so re-trim must kick in
  const title = 'a'.repeat(50) + ' ' + 'b'.repeat(20)
  const out = slugify(title)
  expect(out.length).toBeLessThanOrEqual(50)
  expect(out.endsWith('-')).toBe(false)
})

test('slugify: returns empty string when nothing usable remains', () => {
  expect(slugify('!!!???')).toBe('')
  expect(slugify('')).toBe('')
})

test('slugify: keeps digits', () => {
  expect(slugify('Go 1.22 release notes')).toBe('go-1-22-release-notes')
})
