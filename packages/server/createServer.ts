import {
  IConnection,
  TextDocuments,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument' 
import { CodeAction, TextDocumentEdit, TextEdit, Position, CodeActionKind } from 'vscode-languageserver-types'
import cache from './cache'
import complete from './complete'
import createDiagnostics from './createDiagnostics'
import createConnection from './createConnection'
import yargs from 'yargs'
import SettingStore from './SettingStore'
import { Schema } from './database_libs/AbstractClient'
import getDatabaseClient from './database_libs/getDatabaseClient'
import initializeLogging from './initializeLogging'
import log4js from 'log4js'

export type ConnectionMethod = 'node-ipc' | 'stdio'
type Args = {
	method?: ConnectionMethod
}

export default function createServer() {
  let connection: IConnection = createConnection((yargs.argv as Args).method || 'node-ipc')
  initializeLogging()
  const logger = log4js.getLogger()
  let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)
  documents.listen(connection);
  let schema: Schema = []

  documents.onDidChangeContent((params) => {
    logger.debug(`onDidChangeContent: ${params.document.uri}, ${params.document.version}`)
    const diagnostics = createDiagnostics(params.document.uri, params.document.getText())
    connection.sendDiagnostics(diagnostics)
  })

  connection.onInitialize((params): InitializeResult => {
    logger.debug(`onInitialize: ${params.rootPath}`)
  	SettingStore.getInstance().on('change', async () => {
  		try {
    		const client = getDatabaseClient(SettingStore.getInstance().getSetting())
  			schema = await client.getSchema()
  			logger.debug('get schema')
        logger.debug(JSON.stringify(schema))
        connection.sendNotification('sqlLanguageServer.finishSetup', {
          personalConfig: SettingStore.getInstance().getPersonalConfig(),
          config: SettingStore.getInstance().getSetting()
        })
  		} catch (e) {
  			logger.error(e)
  		}
  	})
  	if (params.rootPath) {
      SettingStore.getInstance().setSettingFromFile(
        `${process.env.HOME}/.config/sql-language-server/.sqllsrc.json`,
        `${params.rootPath}/.sqllsrc.json`,
        params.rootPath || ''
      )
  	}
    return {
      capabilities: {
        textDocumentSync: 1,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.'],
        },
        codeActionProvider: true,
        executeCommandProvider: {
          commands: ['sqlLanguageServer.switchDatabaseConnection']
        }
      }
    }
  })

  connection.onCompletion((docParams: TextDocumentPositionParams): CompletionItem[] => {
    let text = documents.get(docParams.textDocument.uri)?.getText()
    if (!text) {
      return []
    }
  	logger.debug(text || '')
  	const candidates = complete(text, {
  		line: docParams.position.line,
  		column: docParams.position.character
  	}, schema).candidates
  	logger.debug(candidates.map(v => v.label).join(","))
  	return candidates
  })

  connection.onCodeAction(params => {
    const lintResult = cache.findLintCacheByRange(params.textDocument.uri, params.range)
    const document = documents.get(params.textDocument.uri)
    if (!document) {
      return []
    }
    const text = document.getText()
    if (!text) {
      return []
    }

    function toPosition(text: string, offset: number) {
      const lines = text.slice(0, offset).split('\n')
      return Position.create(lines.length - 1, lines[lines.length - 1].length)
    }
    return lintResult.map(v => {
      const fixes = Array.isArray(v.lint.fix) ? v.lint.fix : [v.lint.fix]
      if (fixes.length === 0) {
        return []
      }
      const action = CodeAction.create(`fix: ${v.diagnostic.message}`, {
        documentChanges:[
          TextDocumentEdit.create({ uri: params.textDocument.uri, version: document.version }, fixes.map(v => {
            const edit = v.range.startOffset === v.range.endOffset
              ? TextEdit.insert(toPosition(text, v.range.startOffset), v.text)
              : TextEdit.replace({
                  start: toPosition(text, v.range.startOffset),
                  end: toPosition(text, v.range.endOffset)
                }, v.text)
            return edit
          }))
        ]
      }, CodeActionKind.QuickFix)
      action.diagnostics = params.context.diagnostics
      return [action]
    }).flat()
  })
  
  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item
  })

  connection.onExecuteCommand((request) => {
    logger.debug(`received executeCommand request: ${request.command}, ${request.arguments}`)
    if (request.command === 'switchDatabaseConnection') {
      try{
        SettingStore.getInstance().changeConnection(
          request.arguments && request.arguments[0] || ''
        )
      } catch (e) {
        connection.sendNotification('sqlLanguageServer.error', {
          message: e.message
        })
      }
    }
  })

  connection.listen()
  logger.info('start sql-languager-server')
  return connection
}
