/// <reference types="monaco-editor-core/monaco"/>

import { listen, MessageConnection } from "vscode-ws-jsonrpc";
import {
  MonacoLanguageClient,
  MonacoServices,
  createConnection,
  ExecuteCommandParams,
} from "monaco-languageclient";
import ReconnectingWebSocket from "reconnecting-websocket";
import { URI } from 'vscode-uri'

let languageClient: MonacoLanguageClient;
let connectionNames: string[] = []
let connectedConnectionName = ''

export function initClient() {
  monaco.languages.register({
    id: "sql",
    extensions: [".sql"],
    aliases: ["SQL", "sql"],
    mimetypes: ["application/json"],
  });

  const value = `SELECT * FROM users`;
  const editor = monaco.editor.create(document.getElementById("container")!, {
    model: monaco.editor.createModel(
      value,
      "sql",
      monaco.Uri.parse("inmemory://model.sql")
    ),
    glyphMargin: true,
    tabCompletion: "on",
  });

  MonacoServices.install(editor);

  const URL = "ws://localhost:3000/server";
  const webSocket = createWebSocket(URL) as WebSocket;
  listen({
    webSocket,
    onConnection: (connection) => {
      languageClient = createLanguageClient(connection);
      const disposable = languageClient.start();
      connection.onClose(() => disposable.dispose());
      languageClient.onReady().then(() => {
        languageClient.onNotification('sqlLanguageServer.finishSetup', (params) => {
          connectionNames =
            params.personalConfig?.connections?.
              map((v: { name: string}) => v.name).
              filter((v: string) => !!v)
          connectedConnectionName = params.config?.name || ''
        })
      })
    },
  });

  function createLanguageClient(
    connection: MessageConnection
  ): MonacoLanguageClient {
    return new MonacoLanguageClient({
      name: "SQL Language Server MonacoClient",
      clientOptions: {
        documentSelector: ["sql"],
        workspaceFolder: {
          uri: URI.file('/opt/sql-language-server/example/monaco_editor'),
          name: 'workspace',
          index: 0
        }
      },
      connectionProvider: {
        get: (errorHandler, closeHandler) => {
          return Promise.resolve(
            createConnection(connection, errorHandler, closeHandler)
          );
        },
      },
    });
  }

  function createWebSocket(url: string): ReconnectingWebSocket {
    const socketOptions = {
      maxReconnectionDelay: 10000,
      minReconnectionDelay: 1000,
      reconnectionDelayGrowFactor: 1.3,
      connectionTimeout: 10000,
      maxRetries: Infinity,
      debug: false,
    };
    return new ReconnectingWebSocket(url, [], socketOptions);
  }
}

export function getLanguageClient() {
  return languageClient;
}

export function executeFixAllFixableProblemsCommand() {
  const params: ExecuteCommandParams = {
    command: 'fixAllFixableProblems',
    arguments: ['inmemory://model.sql']
  }
  languageClient.sendRequest('workspace/executeCommand', params)
}

export function executeSwitchDatabaseCommand(db: string) {
  const params: ExecuteCommandParams = {
    command: 'switchDatabaseConnection',
    arguments: [db]
  }
  languageClient.sendRequest('workspace/executeCommand', params)
}

export function getConnectionList() {
  return connectionNames
}

export function getCurrecntConnection() {
  return connectedConnectionName
}