import { Client } from 'pg'
import { Settings } from '../SettingStore'
import AbstractClient, { RawField } from './AbstractClient'

export default class PosgresClient extends AbstractClient {
  connection: Client | null = null

  constructor(settings: Settings) {
    super(settings)

  }

  connect() {
    const client = new Client({
      user: this.settings.user || '',
      host: this.settings.host || '',
      database: this.settings.database || '',
      password: this.settings.password || '',
      port: this.settings.port || 5432,
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
      a.attname as field,
      format_type(a.atttypid, a.atttypmod) as type,
      pg_get_expr(d.adbin, d.adrelid) as default,
      a.attnotnull as null,
      col_description(a.attrelid, a.attnum) AS comment
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
        resolve(results.rows)
      })
    })
  }
}
