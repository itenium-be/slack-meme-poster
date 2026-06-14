import { postSlackMeme } from './post-slack'
import fs from 'fs'

// Coolify binds the tier's Dropbox parent into the container; MEMES_DIR (set per
// resource) selects the tier's subdir. Defaults to /memes for local runs.
const memesDir = process.env.MEMES_DIR ?? '/memes'

// Find a random meme
const notMemes = ['.gitkeep', '@eaDir', 'already-sent', 'cat.jpg', 'not-sending']
const allMemes = fs.readdirSync(memesDir).filter(fn => !notMemes.includes(fn))

// Empty folder = nothing to post (also catches a missing/empty mount). Exit cleanly.
if (allMemes.length === 0) {
  console.log(`No memes left to post in ${memesDir} — nothing to do`)
  process.exit(0)
}

const theMeme = allMemes[Math.floor(Math.random() * allMemes.length)]

const sentPath = `${memesDir}/already-sent/${theMeme}`
fs.renameSync(`${memesDir}/${theMeme}`, sentPath)
console.log('Picked', theMeme)


// Upload the meme to Slack
await postSlackMeme(sentPath)
