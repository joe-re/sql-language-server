import * as monaco from 'monaco-editor'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import { SqlLanguageClient } from './lspClient'

declare const __WORKSPACE_ROOT__: string

self.MonacoEnvironment = { getWorker: () => new EditorWorker() }

const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T
const connectionSelect = $<HTMLSelectElement>('connection')
const status = $<HTMLSpanElement>('status')
const error = $<HTMLDivElement>('error')

const model = monaco.editor.createModel(
  'SELECT * FROM users\n',
  'sql',
  monaco.Uri.parse('inmemory://example/query.sql')
)
monaco.editor.create($('editor'), { model, automaticLayout: true })

const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/lsp`
const client = new SqlLanguageClient(model, url, __WORKSPACE_ROOT__, {
  onStatus: (s) => (status.textContent = s),
  onFinishSetup: (params) => {
    const names = (params.personalConfig?.connections ?? [])
      .map((v) => v.name)
      .filter((v): v is string => !!v)
    const current = params.config?.name ?? ''
    connectionSelect.replaceChildren(
      ...[...new Set([current, ...names])].filter(Boolean).map((name) => {
        const option = new Option(name, name, false, name === current)
        return option
      })
    )
    error.textContent = ''
  },
  onError: (message) => (error.textContent = message),
})

connectionSelect.addEventListener('change', () =>
  client.executeCommand('switchDatabaseConnection', [connectionSelect.value])
)
$('fix').addEventListener('click', () =>
  client.executeCommand('fixAllFixableProblems', [model.uri.toString()])
)
