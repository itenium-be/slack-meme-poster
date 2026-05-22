// ai-job/schedule.test.js
import { test, expect } from 'bun:test'
import { previousRun, redditWindow } from './schedule.js'

// Weekly cron: Fridays 16:00. Run "now" is Fri 2026-05-22 16:00:05 UTC.
const NOW = new Date('2026-05-22T16:00:05Z')

test('previousRun: returns the fire before the current one', () => {
  const since = previousRun('0 16 * * fri', NOW, 'UTC')
  // current fire is 2026-05-22 16:00; previous is 2026-05-15 16:00
  expect(since.toISOString()).toBe('2026-05-15T16:00:00.000Z')
})

test('previousRun: falls back to now-7d on unparseable cron', () => {
  const since = previousRun('not a cron', NOW, 'UTC')
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  expect(since.getTime()).toBe(NOW.getTime() - sevenDaysMs)
})

test('redditWindow: maps gap size to reddit t value', () => {
  const h = (n) => new Date(NOW.getTime() - n * 3600 * 1000)
  expect(redditWindow(h(0.5), NOW)).toBe('hour')
  expect(redditWindow(h(20), NOW)).toBe('day')
  expect(redditWindow(h(24 * 6), NOW)).toBe('week')
  expect(redditWindow(h(24 * 20), NOW)).toBe('month')
  expect(redditWindow(h(24 * 200), NOW)).toBe('year')
})

test('redditWindow: boundaries are inclusive of the lower bucket (<=)', () => {
  const h = (n) => new Date(NOW.getTime() - n * 3600 * 1000)
  expect(redditWindow(h(1), NOW)).toBe('hour')
  expect(redditWindow(h(1.0001), NOW)).toBe('day')
  expect(redditWindow(h(24), NOW)).toBe('day')
  expect(redditWindow(h(24.0001), NOW)).toBe('week')
  expect(redditWindow(h(24 * 7), NOW)).toBe('week')
  expect(redditWindow(h(24 * 7 + 0.0001), NOW)).toBe('month')
  expect(redditWindow(h(24 * 31), NOW)).toBe('month')
  expect(redditWindow(h(24 * 31 + 0.0001), NOW)).toBe('year')
})
