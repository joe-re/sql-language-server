import * as mysql from 'mysql'
import { Setting } from '../SettingStore'

type RawField = {
  Field: string,
  Type: string,
  Collation: null | string,
  Null: 'Yes' | 'No',
  Default: any,
  Extra: string,
  Privilleges: string,
  Comment: string
}
export default class MysqlClient {
  connection: mysql.Connection | null = null

  constructor(private setting: Setting) {}

  connect() {
    this.connection = mysql.createConnection({
      host: this.setting.host || 'localhost',
      password: this.setting.password || '',
      user: this.setting.user || 'root',
      port: Number(this.setting.port) || 3306,
      database: this.setting.database || undefined
    })
  }

  endConnection() {
    if (!this.connection) {
      throw new Error("Don't have database connection.")
    }
    this.connection.end()
  }

  async getSchema() {
    const tables = await this.getTables()
    const schema = await Promise.all(
      tables.map((v) => this.getColumns(v).then(columns => ({ database: this.setting.database, tableName: v, columns })))
    )
    return schema
  }

  getTables(): Promise<string[]> {
    const sql = `
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = '${this.setting.database}'
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
