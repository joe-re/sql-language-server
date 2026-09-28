// Smoke test for the standalone executables built by build-binaries.mjs.
//
// usage: node scripts/smoke-binary.mjs <directory containing the executables>
//
// Checks --version, an LSP session over stdio (diagnostics, and completion of
// a table read from sqlite through node:sqlite) and sqlint.

import { execFileSync, spawn } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.resolve(process.argv[2] ?? '')
const ext = process.platform === 'win32' ? '.exe' : ''
const server = path.join(dir, `sql-language-server${ext}`)
const sqlint = path.join(dir, `sqlint${ext}`)
const expectedVersion = JSON.parse(
  readFileSync(path.join(root, 'packages/server/package.json'), 'utf8')
).version

let failed = false
function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    ${detail}`}`)
  if (!ok) failed = true
}

// --version
for (const exe of [server, sqlint]) {
  const out = execFileSync(exe, ['--version'], { encoding: 'utf8' }).trim()
  check(
    `${path.basename(exe)} --version`,
    out === expectedVersion,
    `got ${out}`
  )
}

// A project with a sqlite database configured by .sqllsrc.json
const work = mkdtempSync(path.join(tmpdir(), 'sqlls-smoke-'))
const project = path.join(work, 'project')
const home = path.join(work, 'home')
mkdirSync(project)
mkdirSync(home)
const dbFile = path.join(project, 'smoke.sqlite3')
const db = new DatabaseSync(dbFile)
db.exec('CREATE TABLE smoke_users (id INTEGER PRIMARY KEY, name TEXT)')
db.close()
writeFileSync(
  path.join(project, '.sqllsrc.json'),
  JSON.stringify({ name: 'smoke', adapter: 'sqlite3', filename: dbFile })
)

// LSP session over stdio
const lsp = spawn(server, ['up', '--method', 'stdio'], {
  env: { ...process.env, HOME: home, USERPROFILE: home },
})
let buffer = Buffer.alloc(0)
let id = 0
const pending = new Map()
const notifications = []
const send = (message) => {
  const body = JSON.stringify({ jsonrpc: '2.0', ...message })
  lsp.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
}
const request = (method, params) =>
  new Promise((resolve) => {
    pending.set(++id, resolve)
    send({ id, method, params })
  })
lsp.stdout.on('data', (data) => {
  buffer = Buffer.concat([buffer, data])
  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n')
    if (headerEnd < 0) return
    const length = Number(
      /Content-Length: (\d+)/.exec(buffer.subarray(0, headerEnd).toString())[1]
    )
    if (buffer.length < headerEnd + 4 + length) return
    const message = JSON.parse(
      buffer.subarray(headerEnd + 4, headerEnd + 4 + length).toString()
    )
    buffer = buffer.subarray(headerEnd + 4 + length)
    if (message.id !== undefined && !message.method) {
      pending.get(message.id)?.(message.result)
      pending.delete(message.id)
    } else if (message.method === 'workspace/configuration') {
      send({ id: message.id, result: message.params.items.map(() => null) })
    } else if (message.id !== undefined) {
      send({ id: message.id, result: null })
    } else {
      notifications.push(message)
    }
  }
})
const timeout = setTimeout(() => {
  lsp.kill()
  throw new Error('the LSP session timed out')
}, 30000)
const waitFor = async (predicate, ms = 10000) => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > ms) return false
    await new Promise((r) => setTimeout(r, 100))
  }
  return true
}

const uri = pathToFileURL(path.join(project, 'query.sql')).href
const init = await request('initialize', {
  processId: process.pid,
  rootUri: pathToFileURL(project).href,
  capabilities: { workspace: { configuration: true } },
})
check(
  'initialize',
  !!init?.capabilities?.completionProvider,
  JSON.stringify(init)
)
send({ method: 'initialized', params: {} })
send({
  method: 'textDocument/didOpen',
  params: {
    textDocument: {
      uri,
      languageId: 'sql',
      version: 1,
      text: 'select id from smoke_users\n',
    },
  },
})
const gotDiagnostics = await waitFor(() =>
  notifications.some(
    (n) =>
      n.method === 'textDocument/publishDiagnostics' &&
      n.params.diagnostics.length > 0
  )
)
check('publishes lint diagnostics', gotDiagnostics)

// The schema is loaded asynchronously after initialization
const text = 'SELECT * FROM '
send({
  method: 'textDocument/didChange',
  params: { textDocument: { uri, version: 2 }, contentChanges: [{ text }] },
})
let labels = []
let gotTable = false
for (let n = 0; n < 50 && !gotTable; n++) {
  const result = await request('textDocument/completion', {
    textDocument: { uri },
    position: { line: 0, character: text.length },
  })
  labels = (Array.isArray(result) ? result : (result?.items ?? [])).map(
    (v) => v.label
  )
  gotTable = labels.includes('smoke_users')
  if (!gotTable) await new Promise((r) => setTimeout(r, 200))
}
check(
  'completes a table read through node:sqlite',
  gotTable,
  JSON.stringify(labels)
)
await request('shutdown')
send({ method: 'exit' })
clearTimeout(timeout)

// sqlint
const lint = (args, input) => {
  try {
    return execFileSync(sqlint, args, {
      input,
      encoding: 'utf8',
      cwd: project,
      env: { ...process.env, HOME: home },
    })
  } catch (e) {
    return e.stdout ?? ''
  }
}
check(
  'sqlint --stdin',
  lint(['--stdin'], 'select a from t').includes('reserved-word-case')
)
writeFileSync(path.join(project, 'query.sql'), 'select a from t\n')
check(
  'sqlint <file>',
  lint([path.join(project, 'query.sql')]).includes('reserved-word-case')
)

rmSync(work, { recursive: true, force: true })
lsp.stdin.end()
process.exitCode = failed ? 1 : 0
