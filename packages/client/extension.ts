import * as path from 'path'
import { workspace, ExtensionContext, commands, window as Window } from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'
import { ExecuteCommandParams } from 'vscode-languageserver-protocol'
import { rebuild } from './rebuild'

export function activate(context: ExtensionContext) {
  let serverModule = context.asAbsolutePath(path.join('packages', 'server', 'dist', 'cli.js'))
  let execArgs = ['up', '--method', 'node-ipc']
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  let connectionNames = []
  let connectedConnectionName = ''

  let serverOptions: ServerOptions = {
    run : { module: serverModule, transport: TransportKind.ipc, args: execArgs },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions, args: execArgs }
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{scheme: 'file', language: 'sql', pattern: '**/*.sql'}],
    diagnosticCollectionName: 'sqlLanguageServer',
    synchronize: {
      configurationSection: 'sqlLanguageServer',
      fileEvents: workspace.createFileSystemWatcher('**/.sqllsrc.json')
    }
  }

  let client = new LanguageClient('sqlLanguageServer', 'SQL Language Server', serverOptions, clientOptions)
  client.registerProposedFeatures()
  const disposable = client.start()

  const switchConnection = commands.registerCommand('extension.switchDatabaseConnection', async () => {
    if (connectionNames.length === 0) {
      Window.showWarningMessage("Need to set personal config file at first.")
      return
    }
    const items = connectionNames.map(v => {
      if (connectedConnectionName === v) {
        return { label: `* ${v}`, value: v }
      }
      return { label: `  ${v}`, value: v}
    })
    const selected = await Window.showQuickPick(items)
    if (!selected) {
      return
    }
    const params: ExecuteCommandParams = {
      command: 'switchDatabaseConnection',
      arguments: [selected.value]
    }
    client.sendRequest('workspace/executeCommand', params)
  })

  const fixAllFixableProblem = commands.registerCommand('extension.fixAllFixableProblems', () => {
    const textEditor = Window.activeTextEditor;
    if (!textEditor) {
      return
    }
    const params: ExecuteCommandParams = {
      command: 'fixAllFixableProblems',
      arguments: [textEditor.document.uri.toString()]
    }
    client.sendRequest('workspace/executeCommand', params)
  })

  let isRebuilding = false
  const rebuildSqlite3 = commands.registerCommand('extension.rebuildSqlite3', async () => {
    if (isRebuilding) {
      Window.showInformationMessage('Already started rebuild Sqlite3 process')
      return
    }
    isRebuilding = true
    try {
      Window.showInformationMessage('Start to rebuild Sqlite3.')
      await rebuild()
      Window.showInformationMessage('Done to rebuild Sqlite3.')
    } catch (e) {
      Window.showErrorMessage(e)
    } finally {
      isRebuilding = false
    }
  })

  context.subscriptions.push(switchConnection)
  context.subscriptions.push(fixAllFixableProblem)
  context.subscriptions.push(rebuildSqlite3)
  context.subscriptions.push(disposable)
  client.onReady().then(() => {
    client.onNotification('sqlLanguageServer.finishSetup', (params) => {
      connectionNames =
        params.personalConfig?.connections?.
          map((v: { name: string}) => v.name).
          filter((v: string) => !!v)
      connectedConnectionName = params.config?.name || ''
    })
    client.onNotification('sqlLanguageServer.error', (params) => {
      Window.showErrorMessage(params.message)
    })
  })
}
