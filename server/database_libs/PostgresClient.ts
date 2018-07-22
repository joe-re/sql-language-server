import { Client } from 'pg'
import { Setting } from '../SettingStore'

type RawField = {
  Field: string,
  Type: string,
  Null: string,
  Default: any,
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
export default class PosgresClient {
  connection: Client | null = null

  constructor(private setting: Setting) {}

  connect() {
    const client = new Client({
      user: this.setting.user || '',
      host: this.setting.host || '',
      database: this.setting.database || '',
      password: this.setting.password || '',
      port: this.setting.port || 5432,
    })
    client.connect()
    this.connection = client
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
      description: `${field.Field}(Type: ${field.Type}, Null: ${field.Null}, Default: ${field.Default})`
    }
  }

  getTables(): Promise<string[]> {
    const sql = `
      SELECT c.relname as table_name FROM pg_class c LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r','v','m','f')
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
        const tables = results.rows.map((v: any) => v[`table_name`])
        resolve(tables)
      })
    })
  }

  getColumns(tableName: string): Promise<RawField[]> {
    const sql = `
    SELECT
      a.attname as Field,
      format_type(a.atttypid, a.atttypmod) as Type,
      pg_get_expr(d.adbin, d.adrelid) as Default,
      a.attnotnull as Null,
      col_description(a.attrelid, a.attnum) AS Comment
    FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      LEFT JOIN pg_type t ON a.atttypid = t.oid
      LEFT JOIN pg_collation c ON a.attcollation = c.oid AND a.attcollation <> t.typcollation
    WHERE a.attrelid = '${tableName}'::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
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
        const rows: RawField[] = results.rows.map(v => {
          return {
            Field: v.field,
            Type: v.type,
            Null: v.null ? 'Yes' : 'No',
            Default: v.default,
            Comment: v.comment
          }
        })
        resolve(rows)
      })
    })
  }
}
