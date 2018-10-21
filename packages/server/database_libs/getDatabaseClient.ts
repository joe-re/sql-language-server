import AbstractClient from './AbstractClient'
import MysqlClient from './MysqlClient'
import PostgresClient from './PostgresClient'
import { Settings } from '../SettingStore'

export default function getDatabaseClient(settings: Settings): AbstractClient {
  switch (settings.adapter) {
    case 'mysql': return new MysqlClient(settings)
    case 'postgresql': return new PostgresClient(settings)
    default: throw new Error(`not support ${settings.adapter}`)
  }
}