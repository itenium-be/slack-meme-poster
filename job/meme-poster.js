import { postSlackMeme } from './post-slack.js'
import fs from 'fs'


// Find a random meme
const notMemes = ['.gitkeep', '@eaDir', 'already-sent', 'cat.jpg', 'not-sending']
const allMemes = fs.readdirSync('/memes').filter(fn => !notMemes.includes(fn))
const theMeme = allMemes[Math.floor(Math.random() * allMemes.length)]

fs.renameSync(`/memes/${theMeme}`, `/memes/already-sent/${theMeme}`)
console.log('Picked', theMeme)


// Post the meme to Slack
const memeUrl = process.env.HOST_URL + 'already-sent/' + theMeme
await postSlackMeme(memeUrl)
