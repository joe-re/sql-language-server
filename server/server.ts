import {
	IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments,
	InitializeResult, TextDocumentPositionParams, CompletionItem,
	CompletionItemKind
} from 'vscode-languageserver';
import * as log4js from 'log4js';
import cache from './cache'
import complete from './complete'
import createDiagnostics from './createDiagnostics'

log4js.configure({
  appenders: { server: { type: 'file', filename: `${__dirname}/server.log` } },
  categories: { default: { appenders: ['server'], level: 'debug' } }
});

const logger = log4js.getLogger()


let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

let documents: TextDocuments = new TextDocuments();
documents.listen(connection);


connection.onInitialize((_params): InitializeResult => {
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
	logger.debug(text)
	const candidates = complete(text, {
		line: docParams.position.line,
		column: docParams.position.character
	}, [
	  { table: 'employees', columns: ['job_id', 'employee_id', 'manager_id', 'department_id', 'first_name', 'last_name', 'email', 'phone_number', 'hire_date', 'salary', 'commision_pct'] },
	  { table: 'jobs', columns: ['job_id', 'job_title', 'min_salary', 'max_salary', 'created_at', 'updated_at'] },
	  { table: 'job_history', columns: ['employee_id', 'start_date', 'end_date', 'job_id', 'department_id'] },
	  { table: 'departments', columns: ['department_id', 'department_name', 'manager_id', 'location_id'] },
	  { table: 'locations', columns: ['location_id', 'street_address', 'postal_code', 'ciry', 'state_province', 'country_id'] },
	  { table: 'countries', columns: ['country_id', 'country_name', 'region_id'] },
	  { table: 'regions', columns: ['region_id', 'region_name'] },
	]).candidates
	logger.debug(candidates.join(","))
	return candidates.map(v => ({ label: v, kind: CompletionItemKind.Text }))
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.listen();
