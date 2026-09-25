import * as monaco from 'monaco-editor'
import {
  createMessageConnection,
  MessageConnection,
} from 'vscode-jsonrpc/browser'
import type {
  ApplyWorkspaceEditParams,
  CodeAction,
  Command,
  CompletionItem,
  CompletionList,
  ConfigurationParams,
  Diagnostic,
  PublishDiagnosticsParams,
  Range,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol'
import {
  toSocket,
  WebSocketMessageReader,
  WebSocketMessageWriter,
} from 'vscode-ws-jsonrpc'

// A minimal LSP client that wires one monaco model to sql-language-server.
// It covers the features the server implements: text sync, diagnostics,
// completion, code actions, workspace/applyEdit and executeCommand.

export type ServerEvents = {
  onStatus(status: 'connecting' | 'connected' | 'disconnected'): void
  onFinishSetup(params: {
    personalConfig?: { connections?: { name?: string }[] }
    config?: { name?: string }
  }): void
  onError(message: string): void
}

const toMonacoRange = (r: Range) =>
  new monaco.Range(
    r.start.line + 1,
    r.start.character + 1,
    r.end.line + 1,
    r.end.character + 1
  )

const toLspPosition = (p: monaco.IPosition) => ({
  line: p.lineNumber - 1,
  character: p.column - 1,
})

const toLspRange = (r: monaco.IRange): Range => ({
  start: toLspPosition({
    lineNumber: r.startLineNumber,
    column: r.startColumn,
  }),
  end: toLspPosition({ lineNumber: r.endLineNumber, column: r.endColumn }),
})

// LSP CompletionItemKind (1-based) -> monaco CompletionItemKind
const completionKinds: Record<number, monaco.languages.CompletionItemKind> = {
  1: monaco.languages.CompletionItemKind.Text,
  2: monaco.languages.CompletionItemKind.Method,
  3: monaco.languages.CompletionItemKind.Function,
  5: monaco.languages.CompletionItemKind.Field,
  6: monaco.languages.CompletionItemKind.Variable,
  7: monaco.languages.CompletionItemKind.Class,
  9: monaco.languages.CompletionItemKind.Module,
  14: monaco.languages.CompletionItemKind.Keyword,
  22: monaco.languages.CompletionItemKind.Struct,
}

const toTextEdits = (
  edits: TextEdit[]
): monaco.editor.IIdentifiedSingleEditOperation[] =>
  edits.map((e) => ({ range: toMonacoRange(e.range), text: e.newText }))

function textEditsFor(uri: string, edit: WorkspaceEdit): TextEdit[] {
  const edits: TextEdit[] = [...(edit.changes?.[uri] ?? [])]
  for (const change of edit.documentChanges ?? []) {
    if ('textDocument' in change && change.textDocument.uri === uri) {
      edits.push(...(change.edits as TextEdit[]))
    }
  }
  return edits
}

export class SqlLanguageClient {
  private connection: MessageConnection | null = null
  private version = 0
  // Keep the original LSP diagnostics so code action requests can send them back
  private diagnostics: Diagnostic[] = []
  private readonly uri: string

  constructor(
    private readonly model: monaco.editor.ITextModel,
    private readonly url: string,
    private readonly rootPath: string,
    private readonly events: ServerEvents
  ) {
    this.uri = model.uri.toString()
    this.registerProviders()
    model.onDidChangeContent(() => {
      this.version++
      this.connection?.sendNotification('textDocument/didChange', {
        textDocument: { uri: this.uri, version: this.version },
        contentChanges: [{ text: model.getValue() }],
      })
    })
    this.connect()
  }

  executeCommand(command: string, args: unknown[]) {
    return this.connection?.sendRequest('workspace/executeCommand', {
      command,
      arguments: args,
    })
  }

  private connect() {
    this.events.onStatus('connecting')
    const webSocket = new WebSocket(this.url)
    webSocket.onopen = async () => {
      const socket = toSocket(webSocket)
      const connection = createMessageConnection(
        new WebSocketMessageReader(socket),
        new WebSocketMessageWriter(socket)
      )
      this.listen(connection)
      connection.listen()
      await connection.sendRequest('initialize', {
        processId: null,
        rootPath: this.rootPath,
        rootUri: null,
        capabilities: { workspace: { configuration: true, applyEdit: true } },
      })
      connection.sendNotification('initialized', {})
      this.connection = connection
      this.version++
      connection.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: this.uri,
          languageId: 'sql',
          version: this.version,
          text: this.model.getValue(),
        },
      })
      this.events.onStatus('connected')
    }
    // Reconnect when the server restarts (e.g. `tsx watch`)
    webSocket.onclose = () => {
      this.connection?.dispose()
      this.connection = null
      this.events.onStatus('disconnected')
      setTimeout(() => this.connect(), 1000)
    }
  }

  private listen(connection: MessageConnection) {
    connection.onNotification(
      'textDocument/publishDiagnostics',
      (params: PublishDiagnosticsParams) => {
        if (params.uri !== this.uri) return
        this.diagnostics = params.diagnostics
        monaco.editor.setModelMarkers(
          this.model,
          'sql-language-server',
          params.diagnostics.map((d) => ({
            ...toMonacoRange(d.range),
            message:
              typeof d.message === 'string' ? d.message : d.message.value,
            source: d.source,
            severity:
              d.severity === 1
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
          }))
        )
      }
    )
    connection.onNotification('sqlLanguageServer.finishSetup', (params) =>
      this.events.onFinishSetup(params)
    )
    connection.onNotification(
      'sqlLanguageServer.error',
      (params: { message: string }) => this.events.onError(params.message)
    )
    connection.onRequest(
      'workspace/configuration',
      (params: ConfigurationParams) => params.items.map(() => null)
    )
    connection.onRequest(
      'workspace/applyEdit',
      (params: ApplyWorkspaceEditParams) => {
        const edits = textEditsFor(this.uri, params.edit)
        this.model.pushEditOperations([], toTextEdits(edits), () => null)
        return { applied: true }
      }
    )
  }

  private registerProviders() {
    monaco.languages.registerCompletionItemProvider('sql', {
      triggerCharacters: ['.'],
      provideCompletionItems: async (model, position, context) => {
        if (!this.connection || model !== this.model) return { suggestions: [] }
        const result = await this.connection.sendRequest<
          CompletionItem[] | CompletionList | null
        >('textDocument/completion', {
          textDocument: { uri: this.uri },
          position: toLspPosition(position),
          context: {
            // monaco: 0 Invoke, 1 TriggerCharacter / LSP: 1 Invoked, 2 TriggerCharacter
            triggerKind: context.triggerKind + 1,
            triggerCharacter: context.triggerCharacter,
          },
        })
        const items = Array.isArray(result) ? result : (result?.items ?? [])
        const word = model.getWordUntilPosition(position)
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        )
        return {
          suggestions: items.map((item) => ({
            label: item.label,
            kind:
              completionKinds[item.kind ?? 1] ??
              monaco.languages.CompletionItemKind.Text,
            detail: item.detail,
            documentation:
              typeof item.documentation === 'string'
                ? item.documentation
                : item.documentation?.value,
            insertText: item.insertText ?? item.label,
            range,
          })),
        }
      },
    })

    monaco.languages.registerCodeActionProvider('sql', {
      provideCodeActions: async (model, range) => {
        if (!this.connection || model !== this.model) {
          return { actions: [], dispose: () => {} }
        }
        const lspRange = toLspRange(range)
        const diagnostics = this.diagnostics.filter(
          (d) =>
            d.range.start.line <= lspRange.end.line &&
            d.range.end.line >= lspRange.start.line
        )
        const result = await this.connection.sendRequest<
          (CodeAction | Command)[] | null
        >('textDocument/codeAction', {
          textDocument: { uri: this.uri },
          range: lspRange,
          context: { diagnostics },
        })
        const actions = (result ?? [])
          .filter((v): v is CodeAction => 'edit' in v && !!v.edit)
          .map((action) => ({
            title: action.title,
            kind: action.kind,
            isPreferred: action.isPreferred,
            edit: {
              edits: textEditsFor(this.uri, action.edit!).map((e) => ({
                resource: model.uri,
                textEdit: { range: toMonacoRange(e.range), text: e.newText },
                versionId: undefined,
              })),
            },
          }))
        return { actions, dispose: () => {} }
      },
    })
  }
}
