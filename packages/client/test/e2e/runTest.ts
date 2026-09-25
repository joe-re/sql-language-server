import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import { runTests } from '@vscode/test-electron'

// Launches VS Code with the extension from the repository root against a
// temporary workspace whose sqlite3 connection is configured in settings.json.
async function main() {
  const repoRoot = path.resolve(__dirname, '../../../..')
  const workspace = mkdtempSync(path.join(tmpdir(), 'sqlls-e2e-'))
  try {
    const dbFile = path.join(workspace, 'e2e.sqlite3')
    const db = new DatabaseSync(dbFile)
    db.exec(
      'CREATE TABLE e2e_users (id INTEGER PRIMARY KEY, e2e_name TEXT NOT NULL)'
    )
    db.close()
    mkdirSync(path.join(workspace, '.vscode'))
    writeFileSync(
      path.join(workspace, '.vscode', 'settings.json'),
      JSON.stringify({
        'sqlLanguageServer.connections': [
          { name: 'e2e-sqlite', adapter: 'sqlite3', filename: dbFile },
        ],
      })
    )

    await runTests({
      version: process.env.VSCODE_VERSION || 'stable',
      extensionDevelopmentPath: repoRoot,
      extensionTestsPath: path.resolve(__dirname, 'suite'),
      launchArgs: [
        workspace,
        '--disable-extensions',
        '--disable-workspace-trust',
      ],
      extensionTestsEnv: { SQLLS_E2E_WORKSPACE: workspace },
    })
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

main().catch((e) => {
  console.error('Failed to run VS Code tests', e)
  process.exitCode = 1
})
