import express from "express";
import ws from "ws";
import type http from "http";
import type net from "net";
import url from "url";
import type rpc from "vscode-ws-jsonrpc";
import { launchServer } from "./launchServer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
process.on("uncaughtException", function (err: any) {
  console.error("Uncaught Exception: ", err.toString());
  if (err.stack) {
    console.error(err.stack);
  }
});

let server: http.Server
 
function startServer() {
  const app = express();
  app.use(express.static(`${process.cwd()}/dist`));
  server = app.listen(3000);
  console.log('startServer')

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
            launchServer(socket);
          } else {
            webSocket.on("open", () => {
              console.log("ready to launch server");
              launchServer(socket);
            });
          }
        });
      }
    }
  );
}

startServer()