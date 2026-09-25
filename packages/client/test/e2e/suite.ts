import assert from 'assert'
import path from 'path'
import * as vscode from 'vscode'

// Runs inside the VS Code extension host. Exported as `run` for
// @vscode/test-electron (extensionTestsPath).

type TestCase = { name: string; fn: () => Promise<void> }
const tests: TestCase[] = []
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn })

async function waitFor<T>(
  description: string,
  fn: () => T | undefined | Promise<T | undefined>,
  timeoutMs = 30000
): Promise<T> {
  const start = Date.now()
  for (;;) {
    const value = await fn()
    if (value) return value
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${description}`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}

async function openSqlDocument(name: string, text: string) {
  const workspace = process.env.SQLLS_E2E_WORKSPACE!
  const uri = vscode.Uri.file(path.join(workspace, name))
  await vscode.workspace.fs.writeFile(uri, Buffer.from(text))
  const document = await vscode.workspace.openTextDocument(uri)
  await vscode.window.showTextDocument(document)
  assert.strictEqual(document.languageId, 'sql')
  return document
}

async function completionLabels(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  const list = await vscode.commands.executeCommand<vscode.CompletionList>(
    'vscode.executeCompletionItemProvider',
    document.uri,
    position
  )
  return list.items.map((v) =>
    typeof v.label === 'string' ? v.label : v.label.label
  )
}

test('reports sqlint diagnostics', async () => {
  const document = await openSqlDocument('lint.sql', 'select id from users\n')
  const diagnostics = await waitFor('diagnostics', () => {
    const v = vscode.languages.getDiagnostics(document.uri)
    return v.length > 0 ? v : undefined
  })
  const messages = diagnostics.map((v) => v.message)
  assert.ok(
    messages.includes('reserved word must be uppercase'),
    `unexpected diagnostics: ${JSON.stringify(messages)}`
  )
})

test('completes keywords and tables read through node:sqlite', async () => {
  const text = 'SELECT * FROM '
  const document = await openSqlDocument('complete.sql', text)
  const position = new vscode.Position(0, text.length)
  // The schema is loaded asynchronously after the server has initialized
  const labels = await waitFor('table completion', async () => {
    const v = await completionLabels(document, position)
    return v.includes('e2e_users') ? v : undefined
  })
  assert.ok(labels.includes('SELECT'), JSON.stringify(labels))
})

test('fixes all fixable problems', async () => {
  const document = await openSqlDocument(
    'fix.sql',
    'SELECT id FROM users WHERE id=1\n'
  )
  await waitFor('diagnostics', () =>
    vscode.languages.getDiagnostics(document.uri).length > 0 ? true : undefined
  )
  await vscode.commands.executeCommand('extension.fixAllFixableProblems')
  const fixed = await waitFor('document to be fixed', () =>
    document.getText() !== 'SELECT id FROM users WHERE id=1\n'
      ? document.getText()
      : undefined
  )
  assert.notStrictEqual(fixed, 'SELECT id FROM users WHERE id=1\n')
})

export async function run(): Promise<void> {
  const failures: string[] = []
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`  ✓ ${name}`)
    } catch (e) {
      console.error(`  ✗ ${name}\n`, e)
      failures.push(name)
    }
  }
  console.log(`${tests.length - failures.length}/${tests.length} passed`)
  if (failures.length > 0) {
    throw new Error(`${failures.length} test(s) failed: ${failures.join(', ')}`)
  }
}
