import {
	IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments, TextDocument,
	Diagnostic, DiagnosticSeverity, InitializeResult, TextDocumentPositionParams, CompletionItem,
	CompletionItemKind
} from 'vscode-languageserver';
import * as log4js from 'log4js';
import cache from './cache'
import complete from './complete'

log4js.configure({
  appenders: { server: { type: 'file', filename: `${__dirname}/server.log` } },
  categories: { default: { appenders: ['server'], level: 'debug' } }
});

const logger = log4js.getLogger()


// Create a connection for the server. The connection uses Node's IPC as a transport
let connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

let documents: TextDocuments = new TextDocuments();
documents.listen(connection);


let shouldSendDiagnosticRelatedInformation: boolean = false;

connection.onInitialize((_params): InitializeResult => {
	shouldSendDiagnosticRelatedInformation = _params.capabilities && _params.capabilities.textDocument && _params.capabilities.textDocument.publishDiagnostics && _params.capabilities.textDocument.publishDiagnostics.relatedInformation;
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

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
// documents.onDidChangeContent((change) => {
//   logger.debug(`didChangeContent: ${change.document.uri}`)
//   cache.set(change.document.uri, change.document.getText())
// });

// The settings interface describe the server relevant settings part
interface Settings {
	sqlLanguageServer: SqlLanguageServerSettings;
}

// These are the example settings we defined in the client's package.json
// file
interface SqlLanguageServerSettings {
	maxNumberOfProblems: number;
}

// hold the maxNumberOfProblems setting
let maxNumberOfProblems: number;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
	let settings = <Settings>change.settings;
	maxNumberOfProblems = settings.sqlLanguageServer.maxNumberOfProblems || 100;
	// Revalidate any open text documents
	documents.all().forEach(validateTextDocument);
});
connection.onDidChangeTextDocument((params) => {
  logger.debug(`didChangeTextDocument: ${params.textDocument.uri}`)
  cache.set(params.textDocument.uri, params.contentChanges[0].text)
});

function validateTextDocument(textDocument: TextDocument): void {
	let diagnostics: Diagnostic[] = [];
	let lines = textDocument.getText().split(/\r?\n/g);
	let problems = 0;
	for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
		let line = lines[i];
		let index = line.indexOf('typescript');
		if (index >= 0) {
			problems++;

			let diagnosic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: {
					start: { line: i, character: index },
					end: { line: i, character: index + 10 }
				},
				message: `${line.substr(index, 10)} should be spelled TypeScript`,
				source: 'ex'
			};
			if (shouldSendDiagnosticRelatedInformation) {
				diagnosic.relatedInformation = [
					{
						location: {
							uri: textDocument.uri,
							range: {
								start: { line: i, character: index },
								end: { line: i, character: index + 10 }
							}
						},
						message: 'Spelling matters'
					},
					{
						location: {
							uri: textDocument.uri,
							range: {
								start: { line: i, character: index },
								end: { line: i, character: index + 10 }
							}
						},
						message: 'Particularly for names'
					}
				];
			}
			diagnostics.push(diagnosic);
		}
	}
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles((_change) => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
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
	  { table: 'contries', columns: ['country_id', 'country_name', 'region_id'] },
	  { table: 'regions', columns: ['region_id', 'region_name'] },
	]).candidates
	logger.debug(candidates.join(","))
	return candidates.map(v => ({ label: v, kind: CompletionItemKind.Text }))
});

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});


/*
connection.onDidOpenTextDocument((params) => {
	// A text document got opened in VSCode.
	// params.uri uniquely identifies the document. For documents store on disk this is a file URI.
	// params.text the initial full content of the document.
	connection.console.log(`${params.textDocument.uri} opened.`);
});

connection.onDidCloseTextDocument((params) => {
	// A text document got closed in VSCode.
	// params.uri uniquely identifies the document.
	connection.console.log(`${params.textDocument.uri} closed.`);
});
*/

// Listen on the connection
connection.listen();
