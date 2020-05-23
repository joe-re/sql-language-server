import { IConnection, TextDocuments, InitializeResult, TextDocumentPositionParams, CompletionItem } from 'vscode-languageserver';
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

  let documents: TextDocuments = new TextDocuments()
  documents.listen(connection);
  let schema: Schema = []

  connection.onInitialize((params): InitializeResult => {
    logger.debug(`onInitialize: ${params.rootPath}`)
  	SettingStore.getInstance().on('change', async () => {
  		try {
    		const client = getDatabaseClient(SettingStore.getInstance().getSetting())
  			schema = await client.getSchema()
  			logger.debug('get schema')
  			logger.debug(JSON.stringify(schema))
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
        textDocumentSync: documents.syncKind,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['.'],
        }
      }
    }
  })
  
  connection.onDidChangeTextDocument((params) => {
    logger.debug(`didChangeTextDocument: ${params.textDocument.uri}`)
    cache.set(params.textDocument.uri, params.contentChanges[0].text)
    const diagnostics = createDiagnostics(params.textDocument.uri, params.contentChanges[0].text)
    connection.sendDiagnostics(diagnostics)
  })
  
  connection.onCompletion((docParams: TextDocumentPositionParams): CompletionItem[] => {
  	let text = cache.get(docParams.textDocument.uri)
  	if (!text) {
  		cache.setFromUri(docParams.textDocument.uri)
  		text = cache.get(docParams.textDocument.uri)
  	}
  	logger.debug(text || '')
  	const candidates = complete(text || '', {
  		line: docParams.position.line,
  		column: docParams.position.character
  	}, schema).candidates
  	logger.debug(candidates.map(v => v.label).join(","))
  	return candidates
  })
  
  connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
  })

  connection.listen()
  logger.info('start server')
  return connection
}
