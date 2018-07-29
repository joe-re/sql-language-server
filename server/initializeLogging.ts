import * as log4js from 'log4js';
import { IConnection } from 'vscode-languageserver'
import * as path from 'path'
import * as os from 'os'

const MAX_LOG_SIZE = 1024 * 1024
const MAX_LOG_BACKUPS = 10
const LOG_FILE_PATH = path.join(os.tmpdir(), 'sql-language-server.log')

export default function initializeLogging(connection: IConnection) {
  log4js.configure({
    appenders: {
      server: {
        type: 'file',
        filename: LOG_FILE_PATH,
        axLogSize: MAX_LOG_SIZE,
        ackups: MAX_LOG_BACKUPS
      }
    },
    categories: { default: { appenders: ['server'], level: process.argv.includes('--debug') ? 'debug' : 'warn' } }
  })
  connection.console.log(LOG_FILE_PATH)

  const logger = log4js.getLogger()
  process.on('uncaughtException', e => logger.error('uncaughtException', e))
  process.on('unhandledRejection', e => logger.error('unhandledRejection', e))

  global.console.log = connection.console.log.bind(connection.console)
  global.console.error = connection.console.error.bind(connection.console)

  console.log(os.tmpdir())
  connection.console.log(os.tmpdir())
  return logger
}