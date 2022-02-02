import { createServer } from '../src/createServer'
createServer({ method: 'node-ipc', debug: process.argv[2] === 'true' })