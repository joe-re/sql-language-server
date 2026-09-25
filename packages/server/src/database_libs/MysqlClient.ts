import mysql, { Connection as MySqlConnection } from 'mysql2/promise'
import { Connection } from '../SettingStore'
import AbstractClient, { RawField } from './AbstractClient'

export default class MysqlClient extends AbstractClient {
  connection: MySqlConnection | null = null

  constructor(settings: Connection) {
    super(settings)
  }

  get DefaultPort() {
    return 3306
  }
  get DefaultHost() {
    return '127.0.0.1'
  }
  get DefaultUser() {
    return 'root'
  }

  async connect() {
    this.connection = await mysql.createConnection({
      host: this.settings.host || this.DefaultHost,
      password: this.settings.password || '',
      user: this.settings.user || this.DefaultUser,
      port: this.settings.port || this.DefaultPort,
      database: this.settings.database || '',
    })
    return true
  }

  disconnect() {
    if (this.connection) {
      this.connection.end()
    }
    this.connection = null
  }

  async getTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error("Don't have database connection.")
    }
    const [results] = await this.connection.query<mysql.RowDataPacket[]>(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
    `,
      [this.settings.database]
    )
    return results.map((v) => v['table_name'] || v['TABLE_NAME'])
  }

  async getColumns(tableName: string): Promise<RawField[]> {
    if (!this.connection) {
      throw new Error("Don't have database connection.")
    }
    const [results] = await this.connection.query<mysql.RowDataPacket[]>(
      `SHOW FULL FIELDS FROM ${mysql.escapeId(tableName)}`
    )
    return results.map((v) => ({
      field: v.Field,
      type: v.Type,
      null: v.Null === 'YES' ? 'Yes' : 'No',
      default: v.Default,
      comment: v.Comment,
    }))
  }
}
