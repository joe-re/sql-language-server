import AbstractClient from './AbstractClient'
import MysqlClient from './MysqlClient'
import PostgresClient from './PostgresClient'
import { Connection } from '../SettingStore'
import Sqlite3Client from './Sqlite3Client'

export default function getDatabaseClient(settings: Connection): AbstractClient {
  switch (settings.adapter) {
    case 'mysql': return new MysqlClient(settings)
    case 'postgres': return new PostgresClient(settings)
    case 'postgresql': return new PostgresClient(settings)
    case 'sqlite3': return new Sqlite3Client(settings)
    default: throw new Error(`not support ${settings.adapter}`)
  }
}