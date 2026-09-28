// Builds standalone executables of sql-language-server and sqlint with
// `bun build --compile`, and packs them per platform into dist-bin/.
//
// usage: node scripts/build-binaries.mjs [target ...]
//   targets: darwin-arm64 darwin-x64 linux-x64 linux-arm64 windows-x64 (default: all)
// Requires bun (see .bun-version) and the packages to be built (pnpm build:sqlint).

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'dist-bin')
const TARGETS = [
  'darwin-arm64',
  'darwin-x64',
  'linux-x64',
  'linux-arm64',
  'windows-x64',
]
const MIN_BUN = [1, 4, 0] // node:sqlite is available from Bun 1.4

const executables = [
  {
    name: 'sql-language-server',
    entry: 'packages/server/bin/cli.ts',
    // ssh2 has optional native accelerators; it falls back to pure JS
    external: ['cpu-features', 'pg-native', '*.node'],
  },
  { name: 'sqlint', entry: 'packages/sqlint/bin/cli.js', external: [] },
]

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', cwd: root, ...options })
}

function checkBun() {
  const version = execFileSync('bun', ['--version'], {
    encoding: 'utf8',
  }).trim()
  const parts = version.split('.').map(Number)
  const diff =
    MIN_BUN.map((v, i) => (parts[i] ?? 0) - v).find((d) => d !== 0) ?? 0
  if (diff < 0) {
    throw new Error(
      `bun ${MIN_BUN.join('.')} or later is required (found ${version})`
    )
  }
  return version
}

const sha256 = (file) =>
  createHash('sha256').update(readFileSync(file)).digest('hex')

const version = JSON.parse(
  readFileSync(path.join(root, 'packages/server/package.json'), 'utf8')
).version
const targets =
  process.argv.slice(2).length > 0 ? process.argv.slice(2) : TARGETS
for (const t of targets) {
  if (!TARGETS.includes(t)) throw new Error(`unknown target: ${t}`)
}

console.log(`bun ${checkBun()}, sql-language-server ${version}`)
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const checksums = []
for (const target of targets) {
  const windows = target.startsWith('windows')
  const dirName = `sql-language-server-v${version}-${target}`
  const dir = path.join(outDir, dirName)
  mkdirSync(dir)
  for (const exe of executables) {
    const outfile = path.join(dir, exe.name + (windows ? '.exe' : ''))
    run('bun', [
      'build',
      '--compile',
      `--target=bun-${target}`,
      exe.entry,
      ...exe.external.flatMap((e) => ['--external', e]),
      '--outfile',
      outfile,
    ])
  }
  copyFileSync(path.join(root, 'LICENSE'), path.join(dir, 'LICENSE'))
  copyFileSync(path.join(root, 'README.md'), path.join(dir, 'README.md'))

  const archive = windows ? `${dirName}.zip` : `${dirName}.tar.gz`
  if (windows) run('zip', ['-qr', archive, dirName], { cwd: outDir })
  else run('tar', ['-czf', archive, dirName], { cwd: outDir })
  checksums.push(`${sha256(path.join(outDir, archive))}  ${archive}`)
}
writeFileSync(path.join(outDir, 'checksums.txt'), checksums.join('\n') + '\n')
console.log(checksums.join('\n'))
