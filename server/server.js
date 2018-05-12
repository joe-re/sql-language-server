/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const log4js = __importStar(require("log4js"));
const cache_1 = __importDefault(require("./cache"));
const complete_1 = __importDefault(require("./complete"));
log4js.configure({
    appenders: { server: { type: 'file', filename: `${__dirname}/server.log` } },
    categories: { default: { appenders: ['server'], level: 'debug' } }
});
const logger = log4js.getLogger();
// Create a connection for the server. The connection uses Node's IPC as a transport
let connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
// Create a simple text document manager. The text document manager
// supports full document sync only
let documents = new vscode_languageserver_1.TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
let shouldSendDiagnosticRelatedInformation = false;
// After the server has started the client sends an initialize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilities.
connection.onInitialize((_params) => {
    shouldSendDiagnosticRelatedInformation = _params.capabilities && _params.capabilities.textDocument && _params.capabilities.textDocument.publishDiagnostics && _params.capabilities.textDocument.publishDiagnostics.relatedInformation;
    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that the server support code complete
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.'],
            }
        }
    };
});
// hold the maxNumberOfProblems setting
let maxNumberOfProblems;
// The settings have changed. Is send on server activation
// as well.
connection.onDidChangeConfiguration((change) => {
    let settings = change.settings;
    maxNumberOfProblems = settings.lspSample.maxNumberOfProblems || 100;
    // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
});
connection.onDidChangeTextDocument((params) => {
    logger.debug(`didChangeTextDocument: ${params.textDocument.uri}`);
    cache_1.default.set(params.textDocument.uri, params.contentChanges[0].text);
});
function validateTextDocument(textDocument) {
    let diagnostics = [];
    let lines = textDocument.getText().split(/\r?\n/g);
    let problems = 0;
    for (var i = 0; i < lines.length && problems < maxNumberOfProblems; i++) {
        let line = lines[i];
        let index = line.indexOf('typescript');
        if (index >= 0) {
            problems++;
            let diagnosic = {
                severity: vscode_languageserver_1.DiagnosticSeverity.Warning,
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
connection.onCompletion((docParams) => {
    let text = cache_1.default.get(docParams.textDocument.uri);
    if (!text) {
        cache_1.default.setFromUri(docParams.textDocument.uri);
        text = cache_1.default.get(docParams.textDocument.uri);
    }
    logger.debug(text);
    const candidates = complete_1.default(text, {
        line: docParams.position.line,
        column: docParams.position.character
    }, [{ table: 'USERS', columns: ['id', 'email', 'created_at', 'updated_at'] }]).candidates;
    logger.debug(candidates.join(","));
    return candidates.map(v => ({ label: v, kind: vscode_languageserver_1.CompletionItemKind.Text }));
    // return [
    // 	{
    // 		label: 'TypeScript',
    // 		kind: CompletionItemKind.Text,
    // 		data: 1
    // 	},
    // 	{
    // 		label: 'JavaScript',
    // 		kind: CompletionItemKind.Text,
    // 		data: 2
    // 	}
    // ]
});
// This handler resolve additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item) => {
    // if (item.data === 1) {
    //   item.detail = 'TypeScript details dedede',
    //   item.documentation = 'TypeScript documentation'
    // } else if (item.data === 2) {
    //   item.detail = 'JavaScript details',
    //   item.documentation = 'JavaScript documentation'
    // }
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
