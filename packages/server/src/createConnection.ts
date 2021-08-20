import { createConnection as _createConnection, Connection, IPCMessageReader, IPCMessageWriter } from 'vscode-languageserver/node';
import { ConnectionMethod } from './createServer'
import log4js from 'log4js';
const logger = log4js.getLogger()

export default function createConnection(method: ConnectionMethod): Connection {
  logger.debug(`createConnection: method {${method}}`)
  switch (method) {
    case 'stdio': return _createConnection(process.stdin, process.stdout)
    case 'node-ipc':
    default:
      return _createConnection(new IPCMessageReader(process), new IPCMessageWriter(process))
  }
}
