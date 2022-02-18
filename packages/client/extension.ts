import * as path from 'path'
import {
  languages,
  workspace,
  ExtensionContext,
  commands,
  window as Window,
  TextDocument,
  NotebookDocument,
  NotebookCellKind,
  Uri,
  CompletionList,
} from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { ExecuteCommandParams } from 'vscode-languageserver-protocol'
import { rebuild } from './rebuild'

const NOTEBOOK_CELL_SCHEME = 'vscode-notebook-cell'
const SQL = 'sql'
const FILE_EXTENSION = '.sql'
const EMBED_SCHEME = 'sql-language-server'
const MAGICS_DETECTED = [
  '%%sql',
  '%sql',
  '%%sparksql',
  '%sparksql',
  '%%trino',
  '%trino',
]

const SELECTORS = [
  { language: SQL, scheme: EMBED_SCHEME },
  { language: SQL, scheme: NOTEBOOK_CELL_SCHEME },
  { language: SQL, scheme: 'file', pattern: `**/*${FILE_EXTENSION}` },
]

function isSqlMagic(text: string): boolean {
  return MAGICS_DETECTED.some((magic) => text.startsWith(magic))
}

function commentSqlCellMagic(text: string): string {
  return text.replace('%%', '--')
}

export type IDisposable = {
  dispose: () => void
}

const disposables: IDisposable[] = []

export function registerDisposable(disposable: IDisposable) {
  disposables.push(disposable)
}

export function monitorJupyterCells() {
  registerDisposable(
    workspace.onDidOpenNotebookDocument(updateSqlCellsOfDocument)
  )
  registerDisposable(
    workspace.onDidChangeTextDocument((e) => updateSqlCells(e.document))
  )
  workspace.notebookDocuments.forEach(updateSqlCellsOfDocument)
}

function isJupyterNotebook(document?: NotebookDocument) {
  return document?.notebookType === 'jupyter-notebook'
}

async function updateSqlCellsOfDocument(document?: NotebookDocument) {
  if (!document || !isJupyterNotebook(document)) {
    return
  }
  await Promise.all(
    document
      .getCells()
      .filter((item) => item.kind === NotebookCellKind.Code)
      .map((item) => updateSqlCells(item.document))
  )
}

async function updateSqlCells(textDocument: TextDocument) {
  const notebookDocument = getNotebookDocument(textDocument)
  if (!notebookDocument || !isJupyterNotebook(notebookDocument)) {
    return
  }
  if (textDocument.languageId !== 'python') {
    return
  }
  if (!isSqlMagic(textDocument.lineAt(0).text)) {
    return
  }
  await languages.setTextDocumentLanguage(textDocument, SQL)
}

const virtualDocumentContents = new Map<string, string>()
function provideTextDocumentContent(uri: Uri): string {
  let lookupUri = uri.path.slice(1) // remove front slash prefix
  lookupUri = lookupUri.slice(0, -FILE_EXTENSION.length) // remove file extension
  const text = virtualDocumentContents.get(lookupUri)
  // console.log(`lookup vcd ${lookupUri} : ${text}`);
  return text
}

export function getNotebookDocument(
  document: TextDocument | NotebookDocument
): NotebookDocument | undefined {
  return workspace.notebookDocuments.find(
    (item) => item.uri.path === document.uri.path
  )
}

export function activate(context: ExtensionContext) {
  // console.log("sql-language-server extension activated")
  monitorJupyterCells()
  workspace.registerTextDocumentContentProvider(EMBED_SCHEME, {
    provideTextDocumentContent: (uri) => provideTextDocumentContent(uri),
  })

  // Using the location of the javacript file built by `npm run prepublish`
  const serverModule = context.asAbsolutePath(
    path.join('packages', 'server', 'dist', 'vscodeExtensionServer.js')
  )
  const execArgs = ['false'] // [1: debug]
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }
  let connectionNames = []
  let connectedConnectionName = ''

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc, args: execArgs },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
      args: execArgs,
    },
  }

  const clientOptions: LanguageClientOptions = {
    documentSelector: SELECTORS,
    diagnosticCollectionName: 'sqlLanguageServer',
    synchronize: {
      configurationSection: 'sqlLanguageServer',
      // fileEvents: workspace.createFileSystemWatcher('**/.sqllsrc.json')
    },
    middleware: {
      provideCompletionItem: async (
        document,
        position,
        context,
        token,
        next
      ) => {
        const originalUri = document.uri.toString()
        if (originalUri.startsWith(EMBED_SCHEME)) {
          // console.log("Sending modified cell magic text to LSP server")
          return await next(document, position, context, token)
        } else if (isSqlMagic(document.getText())) {
          // console.log("Handling a cell containing sql magic")
          const text = commentSqlCellMagic(document.getText())
          // console.log(`set vdc content ${originalUri} : ${text}`)
          virtualDocumentContents.set(originalUri, text)
          const encodedUri = encodeURIComponent(originalUri)
          const vdocUriString = `${EMBED_SCHEME}://sql/${encodedUri}${FILE_EXTENSION}`
          const vdocUri = Uri.parse(vdocUriString)
          // Invoke completion, this will call us back again
          // but with a virutal document
          // with a properly commented out magic
          return await commands.executeCommand<CompletionList>(
            'vscode.executeCompletionItemProvider',
            vdocUri,
            position,
            context.triggerCharacter
          )
        } else {
          // console.log("Sending .sql file contents to LSP server")
          return await next(document, position, context, token)
        }
      },
    },
  }

  const client = new LanguageClient(
    'sqlLanguageServer',
    'SQL Language Server',
    serverOptions,
    clientOptions
  )
  client.registerProposedFeatures()
  const disposable = client.start()

  const switchConnection = commands.registerCommand(
    'extension.switchDatabaseConnection',
    async () => {
      if (connectionNames.length === 0) {
        Window.showWarningMessage('Need to set personal config file at first.')
        return
      }
      const items = connectionNames.map((v) => {
        if (connectedConnectionName === v) {
          return { label: `* ${v}`, value: v }
        }
        return { label: `  ${v}`, value: v }
      })
      const selected = await Window.showQuickPick(items)
      if (!selected) {
        return
      }
      const params: ExecuteCommandParams = {
        command: 'switchDatabaseConnection',
        arguments: [selected.value],
      }
      client.sendRequest('workspace/executeCommand', params)
    }
  )

  const fixAllFixableProblem = commands.registerCommand(
    'extension.fixAllFixableProblems',
    () => {
      const textEditor = Window.activeTextEditor
      if (!textEditor) {
        return
      }
      const params: ExecuteCommandParams = {
        command: 'fixAllFixableProblems',
        arguments: [textEditor.document.uri.toString()],
      }
      client.sendRequest('workspace/executeCommand', params)
    }
  )

  let isRebuilding = false
  const rebuildSqlite3 = commands.registerCommand(
    'extension.rebuildSqlite3',
    async () => {
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
    }
  )

  context.subscriptions.push(switchConnection)
  context.subscriptions.push(fixAllFixableProblem)
  context.subscriptions.push(rebuildSqlite3)
  context.subscriptions.push(disposable)
  client.onReady().then(() => {
    client.onNotification('sqlLanguageServer.finishSetup', (params) => {
      connectionNames = params.personalConfig?.connections
        ?.map((v: { name: string }) => v.name)
        .filter((v: string) => !!v)
      connectedConnectionName = params.config?.name || ''
    })
    client.onNotification('sqlLanguageServer.error', (params) => {
      Window.showErrorMessage(params.message)
    })
  })
}
