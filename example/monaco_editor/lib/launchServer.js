"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchServer = void 0;
const rpc = require("vscode-ws-jsonrpc");
const vscode_languageserver_1 = require("vscode-languageserver");
const sql_language_server_1 = require("sql-language-server");
function launchServer(socket) {
    const reader = new rpc.WebSocketMessageReader(socket);
    const writer = new rpc.WebSocketMessageWriter(socket);
    const asExternalProccess = process.argv.findIndex((value) => value === "--external") !== -1;
    if (asExternalProccess) {
        // start the language server as an external process
        // TODO: implement it
        // const extJsonServerPath = path.resolve(__dirname, "ext-json-server.js");
        // const socketConnection = server.createConnection(reader, writer, () =>
        //   socket.dispose()
        // );
        // const serverConnection = server.createServerProcess("JSON", "node", [
        //   extJsonServerPath,
        // ]);
        // server.forward(socketConnection, serverConnection, (message) => {
        //   if (rpc.isRequestMessage(message)) {
        //     if (message.method === lsp.InitializeRequest.type.method) {
        //       const initializeParams = message.params as lsp.InitializeParams;
        //       initializeParams.processId = process.pid;
        //     }
        //   }
        //   return message;
        // });
    }
    else {
        // start the language server inside the current process
        const connection = vscode_languageserver_1.createConnection(reader, writer);
        sql_language_server_1.createServerWithConnection(connection);
    }
}
exports.launchServer = launchServer;
//# sourceMappingURL=launchServer.js.map