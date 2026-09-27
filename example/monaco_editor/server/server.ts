import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerWithConnection } from 'sql-language-server'
import { createConnection } from 'vscode-languageserver/node'
import type { IWebSocket } from 'vscode-ws-jsonrpc'
import {
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc'
import { WebSocket, WebSocketServer } from 'ws'

// Runs sql-language-server in this process for each WebSocket connection on
// /lsp. When dist/ exists (pnpm build), it is served as well, so the example
// can run without the Vite dev server.
const PORT = Number(process.env.PORT ?? 3001)
const distDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist'
)
const contentTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
}

const httpServer = createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  const file = path.join(distDir, pathname === '/' ? 'index.html' : pathname)
  if (
    !file.startsWith(distDir) ||
    !existsSync(file) ||
    !statSync(file).isFile()
  ) {
    res.writeHead(404).end('Not found. Run `pnpm build` or use `pnpm dev`.')
    return
  }
  res.writeHead(200, {
    'Content-Type':
      contentTypes[path.extname(file)] ?? 'application/octet-stream',
  })
  res.end(readFileSync(file))
})

const wss = new WebSocketServer({ server: httpServer, path: '/lsp' })
wss.on('connection', (webSocket) => {
  console.log('language client connected')
  const socket = toSocket(webSocket)
  const connection = createConnection(
    new WebSocketMessageReader(socket),
    new WebSocketMessageWriter(socket)
  )
  createServerWithConnection(connection)
  webSocket.on('close', () => {
    console.log('language client disconnected')
    connection.dispose()
  })
})

// vscode-ws-jsonrpc's toSocket() expects a browser WebSocket
function toSocket(webSocket: WebSocket): IWebSocket {
  return {
    $type: 'IWebSocket',
    send: (content) => webSocket.send(content),
    onMessage: (cb) => webSocket.on('message', (data) => cb(data.toString())),
    onError: (cb) => webSocket.on('error', cb),
    onClose: (cb) =>
      webSocket.on('close', (code, reason) => cb(code, reason.toString())),
    dispose: () => webSocket.close(),
  }
}

httpServer.listen(PORT, () => {
  console.log(
    `sql-language-server example: http://localhost:${PORT} (ws: /lsp)`
  )
})
