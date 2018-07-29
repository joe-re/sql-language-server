import * as mysql from 'mysql'
import { Settings } from '../SettingStore'
import AbstractClient, { RawField } from './AbstractClient'

export default class MysqlClient extends AbstractClient {
  connection: mysql.Connection | null = null

  constructor(settings: Settings) {
    super(settings)
  }

  connect() {
    console.log(JSON.stringify(this.settings))
    this.connection = mysql.createConnection({
      host: this.settings.host || 'localhost',
      password: this.settings.password || '',
      user: this.settings.user || 'root',
      port: this.settings.port || 3306,
      database: this.settings.database || undefined
    })
  }

  disconnect() {
    if (this.connection) {
      this.connection.end()
    }
    this.connection = null
  }

  getTables(): Promise<string[]> {
    const sql = `
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = '${this.settings.database}'
    `
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error("Don't have database connection."))
        return
      }
      this.connection.query(sql, (err, results) => {
        if (err) {
          reject(new Error(err.message))
          return
        }
        const tables = results.map((v: any) => v[`table_name`])
        resolve(tables)
      })
    })
  }

  getColumns(tableName: string): Promise<RawField[]> {
    const sql = `SHOW FULL FIELDS FROM ${tableName}`
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error("Don't have database connection."))
        return
      }
      this.connection.query(sql, (err, results) => {
        if (err) {
          reject(new Error(err.message))
          return
        }
        resolve(JSON.parse(JSON.stringify(results)))
      })
    })
  }
}
