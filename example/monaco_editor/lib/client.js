"use strict";
/// <reference types="monaco-editor-core/monaco"/>
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_ws_jsonrpc_1 = require("vscode-ws-jsonrpc");
const monaco_languageclient_1 = require("monaco-languageclient");
const reconnecting_websocket_1 = require("reconnecting-websocket");
monaco.languages.register({
    id: "sql",
    extensions: [".sql"],
    aliases: ["SQL", "sql"],
    mimetypes: ["application/json"],
});
const value = `SELECT * FROM users`;
const editor = monaco.editor.create(document.getElementById("container"), {
    model: monaco.editor.createModel(value, "sql", monaco.Uri.parse("inmemory://model.sql")),
    glyphMargin: true,
    tabCompletion: 'on'
});
monaco_languageclient_1.MonacoServices.install(editor);
const URL = "ws://localhost:3000/server";
const webSocket = createWebSocket(URL);
vscode_ws_jsonrpc_1.listen({
    webSocket,
    onConnection: (connection) => {
        const languageClient = createLanguageClient(connection);
        const disposable = languageClient.start();
        connection.onClose(() => disposable.dispose());
    },
});
function createLanguageClient(connection) {
    return new monaco_languageclient_1.MonacoLanguageClient({
        name: "SQL Language Server MonacoClient",
        clientOptions: {
            documentSelector: ["sql"],
        },
        connectionProvider: {
            get: (errorHandler, closeHandler) => {
                return Promise.resolve(monaco_languageclient_1.createConnection(connection, errorHandler, closeHandler));
            },
        },
    });
}
function createWebSocket(url) {
    const socketOptions = {
        maxReconnectionDelay: 10000,
        minReconnectionDelay: 1000,
        reconnectionDelayGrowFactor: 1.3,
        connectionTimeout: 10000,
        maxRetries: Infinity,
        debug: false,
    };
    return new reconnecting_websocket_1.default(url, [], socketOptions);
}
//# sourceMappingURL=client.js.map