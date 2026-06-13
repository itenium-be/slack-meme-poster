// job/post-slack.test.js
import { test, expect } from 'bun:test'
import {
  HEADERS,
  pickHeader,
  escapeMrkdwn,
  buildComment,
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

test('buildComment: no meta is just the header', () => {
  expect(buildComment('Hello')).toBe('Hello')
})

test('buildComment: with meta appends an escaped reddit title link', () => {
  expect(
    buildComment('Hello', {
      title: 'Foo & <bar>',
      url: 'https://www.reddit.com/r/x/comments/1/foo/',
    }),
  ).toBe('Hello\n🔗 *<https://www.reddit.com/r/x/comments/1/foo/|Foo &amp; &lt;bar&gt;>*')
})
