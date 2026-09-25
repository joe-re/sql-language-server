import PG from 'pg'
import log4js from 'log4js'
import { Connection } from '../SettingStore'
import AbstractClient, { RawField } from './AbstractClient'

const logger = log4js.getLogger()

export default class PosgresClient extends AbstractClient {
  connection: PG.Client | null = null

  constructor(settings: Connection) {
    super(settings)
  }

  get DefaultPort() {
    return 5432
  }
  get DefaultHost() {
    return '127.0.0.1'
  }
  get DefaultUser() {
    return 'postgres'
  }

  async connect(): Promise<boolean> {
    const client: PG.Client = new PG.Client({
      user: this.settings.user || '',
      host: this.settings.host || '',
      database: this.settings.database || '',
      password: this.settings.password || '',
      port: this.settings.port || 5432,
    })
    try {
      await client.connect()
    } catch (err) {
      logger.debug('Failed to connect to postgresql server')
      logger.error(err)
      throw err
    }
    this.connection = client
    logger.debug('Success to connect to postgresql server')
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
    const results = await this.connection.query<{ table_name: string }>(`
      SELECT c.relname as table_name FROM pg_class c LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relkind IN ('r','v','m','f')
    `)
    return results.rows.map((v) => v.table_name)
  }

  async getColumns(tableName: string): Promise<RawField[]> {
    if (!this.connection) {
      throw new Error("Don't have database connection.")
    }
    const results = await this.connection.query<RawField>(
      `
    SELECT
      a.attname as field,
      format_type(a.atttypid, a.atttypmod) as type,
      pg_get_expr(d.adbin, d.adrelid) as default,
      CASE WHEN a.attnotnull THEN 'No' ELSE 'Yes' END as null,
      col_description(a.attrelid, a.attnum) AS comment
    FROM pg_attribute a
      LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
      LEFT JOIN pg_type t ON a.atttypid = t.oid
      LEFT JOIN pg_collation c ON a.attcollation = c.oid AND a.attcollation <> t.typcollation
    WHERE a.attrelid = quote_ident($1)::regclass
      AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
    `,
      [tableName]
    )
    return results.rows
  }
}
