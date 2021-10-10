import * as rpc from "vscode-ws-jsonrpc";
import { createConnection } from 'vscode-languageserver';
import { createServerWithConnection } from 'sql-language-server/src/createServer'

export function launchServer(socket: rpc.IWebSocket) {
  const reader: any = new rpc.WebSocketMessageReader(socket);
  const writer: any = new rpc.WebSocketMessageWriter(socket);
  const asExternalProccess =
    process.argv.findIndex((value) => value === "--external") !== -1;
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
  } else {
    // start the language server inside the current process
    const connection = createConnection(reader, writer)
    createServerWithConnection(connection)
  }
}
