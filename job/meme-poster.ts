import { postSlackMeme } from './post-slack'
import fs from 'fs'


// Find a random meme
const notMemes = ['.gitkeep', '@eaDir', 'already-sent', 'cat.jpg', 'not-sending']
const allMemes = fs.readdirSync('/memes').filter(fn => !notMemes.includes(fn))

// Empty folder = nothing to post (also catches a missing/empty mount). Exit cleanly.
if (allMemes.length === 0) {
  console.log('No memes left to post in /memes — nothing to do')
  process.exit(0)
}

const theMeme = allMemes[Math.floor(Math.random() * allMemes.length)]

const sentPath = `/memes/already-sent/${theMeme}`
fs.renameSync(`/memes/${theMeme}`, sentPath)
console.log('Picked', theMeme)


// Upload the meme to Slack
await postSlackMeme(sentPath)
