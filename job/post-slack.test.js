// job/post-slack.test.js
import { test, expect } from 'bun:test'
import {
  HEADERS,
  pickHeader,
  escapeMrkdwn,
  buildMemeBlocks,
} from './post-slack.js'

test('HEADERS is the curated pool', () => {
  expect(HEADERS).toEqual([
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
  ])
})

test('pickHeader returns a member of HEADERS', () => {
  for (let i = 0; i < 50; i++) {
    expect(HEADERS).toContain(pickHeader())
  }
})

test('escapeMrkdwn escapes &, <, > and leaves other chars alone', () => {
  expect(escapeMrkdwn('a & b < c > d "e" |f|')).toBe('a &amp; b &lt; c &gt; d "e" |f|')
})

test('buildMemeBlocks: daily shape (no meta) is header + image', () => {
  const blocks = buildMemeBlocks('https://h/x/y.jpg', 'Hello')
  expect(blocks).toHaveLength(2)
  expect(blocks[0]).toEqual({
    type: 'header',
    text: { type: 'plain_text', text: 'Hello' },
  })
  expect(blocks[1].type).toBe('image')
  expect(blocks[1].image_url).toBe('https://h/x/y.jpg')
  expect(blocks[1].alt_text).toBe('y.jpg')
  expect(blocks[1].title).toEqual({ type: 'plain_text', text: 'y.jpg', emoji: true })
})

test('buildMemeBlocks: reddit shape (with meta) inserts mrkdwn section', () => {
  const blocks = buildMemeBlocks(
    'https://h/x/2026-05-23-foo.jpg',
    'Hello',
    { title: 'Foo & <bar>', url: 'https://www.reddit.com/r/x/comments/1/foo/' },
  )
  expect(blocks).toHaveLength(3)
  expect(blocks[0].type).toBe('header')
  expect(blocks[1]).toEqual({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '🔗 *<https://www.reddit.com/r/x/comments/1/foo/|Foo &amp; &lt;bar&gt;>*',
    },
  })
  expect(blocks[2].type).toBe('image')
})
