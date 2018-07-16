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
export type Column = {
  columnName: string,
  description: string
}
export type Table = {
  database: string | null,
  tableName: string,
  columns: Column[]
}
export type Schema = Table[]
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

  disconnect() {
    if (this.connection) {
      this.connection.end()
    }
    this.connection = null
  }

  async getSchema(): Promise<Schema> {
    const tables = await this.getTables()
    const schema = await Promise.all(
      tables.map((v) => this.getColumns(v).then(columns => ({
        database: this.setting.database,
        tableName: v,
        columns: columns.map(v => this.toColumnFromRawField(v)) }
      )))
    )
    return schema
  }

  toColumnFromRawField(field: RawField): Column {
    return {
      columnName: field.Field,
      description: `${field.Field}(Type: ${field.Type}, Null: ${field.Null}, Default: ${field.Type})`
    }
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
