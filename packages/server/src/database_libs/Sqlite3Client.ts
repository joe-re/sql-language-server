import { Connection } from '../SettingStore'
import AbstractClient, { RawField } from './AbstractClient'
import { sqlite3 as SQLite3, Database } from 'sqlite3'
import log4js from 'log4js'

const logger = log4js.getLogger()

export class RequireSqlite3Error extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RequireSQLite3Error"
  }
}

export default class Sqlite3Client extends AbstractClient {
  connection: Database | null = null

  get DefaultPort() { return 0 }
  get DefaultHost() { return '' }
  get DefaultUser() { return '' }

  constructor(settings: Connection) {
    super(settings)
  }

  connect(): boolean {
    if (!this.settings.filename) {
      throw new Error('Need to specify filename to use sqlite3 connection.')
    }
    try {
      // use commonjs to avoid dynamic import build error
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqlite3: SQLite3 = require('sqlite3')

      this.connection = new sqlite3.Database(
        this.settings.filename,
        sqlite3.OPEN_READONLY
      )
    } catch (e) {
      logger.error('Sqlite3Client: failed to connect to database', e)
      if (e instanceof Error) {
        throw new RequireSqlite3Error(e.message)
      }
    }
    return true
  }

  disconnect() {
    if (this.connection) {
      this.connection.close()
    }
    this.connection = null
  }

  getTables(): Promise<string[]> {
    const sql = `SELECT name FROM sqlite_master WHERE type='table'`
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error("Don't have database connection."))
        return
      }
      this.connection.all(sql, (err, rows: { name: string}[]) => {
        if (err) {
          reject(new Error(err.message))
          return
        }
        logger.debug('Sqlite3Clinet: done to get table names', rows)
        const tables = rows.map(v => v.name)
        resolve(tables)
      })
    })
  }

  getColumns(tableName: string): Promise<RawField[]> {
    const sql = `SELECT * FROM pragma_table_info('${tableName}')`
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        reject(new Error("Don't have database connection."))
        return
      }
      this.connection.all(sql, (err, rows: {
        cld: number
        name: string
        type: string
        notnull: number
        dflt_value: string
        pk: number
      }[]) => {
        if (err) {
          reject(new Error(err.message))
          return
        }
        logger.debug('Sqlite3Clinet: done to get column names', rows)
        const columns: RawField[] = rows.map(v => ({
          field: v.name,
          type: v.type,
          null: v.notnull ? 'Yes' : 'No',
          default: v.dflt_value,
          comment: v.pk ? 'PRIMARY KEY' : ''
        }))
        resolve(columns)
      })
    })
  }
}