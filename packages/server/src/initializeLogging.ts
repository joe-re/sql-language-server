import * as path from 'path'
import * as os from 'os'
import log4js from 'log4js'

const MAX_LOG_SIZE = 1024 * 1024
const MAX_LOG_BACKUPS = 10
const LOG_FILE_PATH = path.join(os.tmpdir(), 'sql-language-server.log')

export default function initializeLogging(debug = false) {
  log4js.configure({
    appenders: {
      server: {
        type: 'file',
        filename: LOG_FILE_PATH,
        axLogSize: MAX_LOG_SIZE,
        ackups: MAX_LOG_BACKUPS,
      },
    },
    // TODO: Should accept level
    categories: {
      default: { appenders: ['server'], level: debug ? 'debug' : 'debug' },
    },
  })

  const logger = log4js.getLogger()
  process.on('uncaughtException', (e) => logger.error('uncaughtException', e))
  process.on('unhandledRejection', (e) => logger.error('unhandledRejection', e))
  return logger
}
