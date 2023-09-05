import { levels, AppenderModule, Level } from 'log4js'
import { Connection, MessageType } from 'vscode-languageserver'

function mapLogLevel(level: Level): MessageType {
  switch (level.level) {
    case levels.INFO.level:
      return MessageType.Info
    case levels.ERROR.level:
      return MessageType.Error
    case levels.FATAL.level:
      return MessageType.Error
    case levels.DEBUG.level:
    default:
      return MessageType.Log
  }
}

export function getLspAppender(connection: Connection): AppenderModule {
  return {
    configure(_config, layouts) {
      return (loggingEvent) => {
        if (loggingEvent.level.isEqualTo(levels.OFF)) {
          return
        }

        connection.sendNotification('window/logMessage', {
          type: mapLogLevel(loggingEvent.level),
          message: layouts?.messagePassThroughLayout(loggingEvent),
        })
      }
    },
  }
}
