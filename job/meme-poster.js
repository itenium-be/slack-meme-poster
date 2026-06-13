import { postSlackMeme } from './post-slack.js'
import fs from 'fs'


// Find a random meme
const notMemes = ['.gitkeep', '@eaDir', 'already-sent', 'cat.jpg', 'not-sending']
const allMemes = fs.readdirSync('/memes').filter(fn => !notMemes.includes(fn))
const theMeme = allMemes[Math.floor(Math.random() * allMemes.length)]

const sentPath = `/memes/already-sent/${theMeme}`
fs.renameSync(`/memes/${theMeme}`, sentPath)
console.log('Picked', theMeme)


// Upload the meme to Slack
await postSlackMeme(sentPath)
