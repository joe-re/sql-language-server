import { IConnection, TextDocuments, InitializeResult, TextDocumentPositionParams, CompletionItem } from 'vscode-languageserver';
import * as log4js from 'log4js';
import cache from './cache'
import complete from './complete'
import createDiagnostics from './createDiagnostics'
import createConnection from './createConnection'
import { argv } from 'yargs'
import SettingStore from './SettingStore'
import MysqlClient, { Schema } from './database_libs/MysqlClient'

export type ConnectionMethod = 'node-ipc' | 'stdio'
type Args = {
	method?: ConnectionMethod
}

log4js.configure({
  appenders: { server: { type: 'file', filename: `${__dirname}/sql-language-server.log` } },
  categories: { default: { appenders: ['server'], level: 'debug' } }
});

const logger = log4js.getLogger()

let connection: IConnection = createConnection((argv as Args).method || 'node-ipc')

let documents: TextDocuments = new TextDocuments();
documents.listen(connection);
let schema: Schema = [];

connection.onInitialize((params): InitializeResult => {
	logger.debug(`onInitialize: ${params.rootPath}`)
	if (params.rootPath) {
		SettingStore.getInstance().setSettingFromFile(`${params.rootPath}/.sqllsrc.json`)
	}
	SettingStore.getInstance().on('change', async () => {
		const client = new MysqlClient(SettingStore.getInstance().getSetting())
		try {
		  client.connect()
			schema = await client.getSchema()
			logger.debug('get schema')
			logger.debug(JSON.stringify(schema))
		} catch (e) {
			logger.error(e)
		}
		client.disconnect()
	})
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ['.'],
      }
    }
  }
});

connection.onDidChangeTextDocument((params) => {
  logger.debug(`didChangeTextDocument: ${params.textDocument.uri}`)
  cache.set(params.textDocument.uri, params.contentChanges[0].text)
  const diagnostics = createDiagnostics(params.textDocument.uri, params.contentChanges[0].text)
  connection.sendDiagnostics(diagnostics); 
});

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
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.listen();
