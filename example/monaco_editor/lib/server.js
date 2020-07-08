"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const ws = require("ws");
const url = require("url");
const launchServer_1 = require("./launchServer");
process.on("uncaughtException", function (err) {
    console.error("Uncaught Exception: ", err.toString());
    if (err.stack) {
        console.error(err.stack);
    }
});
const app = express();
app.use(express.static(`${process.cwd()}/dist`));
console.log('start, hoge?');
console.log(process.cwd());
const server = app.listen(3000);
const wss = new ws.Server({
    noServer: true,
    perMessageDeflate: false,
});
server.on("upgrade", (request, socket, head) => {
    const path = request.url ? url.parse(request.url).pathname : undefined;
    if (path === "/server") {
        wss.handleUpgrade(request, socket, head, (webSocket) => {
            const socket = {
                send: (content) => webSocket.send(content, (error) => {
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
                launchServer_1.launchServer(socket);
            }
            else {
                webSocket.on("open", () => {
                    // launch(socket)
                    console.log("ready to raunch server2");
                    launchServer_1.launchServer(socket);
                });
            }
        });
    }
});
//# sourceMappingURL=server.js.map