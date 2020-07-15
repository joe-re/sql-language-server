import AbstractClient from './AbstractClient'
import MysqlClient from './MysqlClient'
import PostgresClient from './PostgresClient'
import { Settings } from '../SettingStore'
import Sqlite3Client from './Sqlite3Client'

export default function getDatabaseClient(settings: Settings): AbstractClient {
  switch (settings.adapter) {
    case 'mysql': return new MysqlClient(settings)
    case 'postgres': return new PostgresClient(settings)
    case 'postgresql': return new PostgresClient(settings)
    case 'sqlite3': return new Sqlite3Client(settings)
    default: throw new Error(`not support ${settings.adapter}`)
  }
}