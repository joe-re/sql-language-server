import * as express from "express";
import * as ws from "ws";
import * as http from "http";
import * as net from "net";
import * as url from "url";
import * as rpc from "vscode-ws-jsonrpc";
import { launchServer } from './launchServer'

process.on("uncaughtException", function (err: any) {
  console.error("Uncaught Exception: ", err.toString());
  if (err.stack) {
    console.error(err.stack);
  }
});

const app = express();
app.use(express.static(__dirname));

const server = app.listen(3000);

const wss = new ws.Server({
  noServer: true,
  perMessageDeflate: false,
});

server.on(
  "upgrade",
  (request: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    const path = request.url ? url.parse(request.url).pathname : undefined;
    if (path === "/server") {
      wss.handleUpgrade(request, socket, head, (webSocket) => {
        const socket: rpc.IWebSocket = {
          send: (content) =>
            webSocket.send(content, (error) => {
              if (error) {
                throw error;
              }
            }),
          onMessage: (cb) => webSocket.on("message", cb),
          onError: (cb) => webSocket.on("error", cb),
          onClose: (cb) => webSocket.on("close", cb),
          dispose: () => webSocket.close(),
        };
        if (webSocket.readyState === webSocket.OPEN) {
          console.log("ready to launch server");
          launchServer(socket)
        } else {
          webSocket.on("open", () => {
            // launch(socket)
            console.log("ready to raunch server2");
            launchServer(socket)
          });
        }
      });
    }
  }
);
