import type { DatabaseSync } from 'node:sqlite'
import log4js from 'log4js'
import { Connection } from '../SettingStore'
import AbstractClient, { RawField } from './AbstractClient'

const logger = log4js.getLogger()

export class Sqlite3OpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'Sqlite3OpenError'
  }
}

export default class Sqlite3Client extends AbstractClient {
  connection: DatabaseSync | null = null

  get DefaultPort() {
    return 0
  }
  get DefaultHost() {
    return ''
  }
  get DefaultUser() {
    return ''
  }

  constructor(settings: Connection) {
    super(settings)
  }

  connect(): boolean {
    if (!this.settings.filename) {
      throw new Error('Need to specify filename to use sqlite3 connection.')
    }
    try {
      // Load node:sqlite lazily so that its experimental warning is only
      // emitted for users of the sqlite3 adapter
      const { DatabaseSync } = process.getBuiltinModule('node:sqlite')
      this.connection = new DatabaseSync(this.settings.filename, {
        readOnly: true,
      })
    } catch (e) {
      logger.error('Sqlite3Client: failed to connect to database', e)
      throw new Sqlite3OpenError(e instanceof Error ? e.message : String(e))
    }
    return true
  }

  disconnect() {
    if (this.connection) {
      this.connection.close()
    }
    this.connection = null
  }

  async getTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error("Don't have database connection.")
    }
    const rows = this.connection
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all() as { name: string }[]
    logger.debug('Sqlite3Clinet: done to get table names', rows)
    return rows.map((v) => v.name)
  }

  async getColumns(tableName: string): Promise<RawField[]> {
    if (!this.connection) {
      throw new Error("Don't have database connection.")
    }
    const rows = this.connection
      .prepare('SELECT * FROM pragma_table_info(?)')
      .all(tableName) as {
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: string
      pk: number
    }[]
    logger.debug('Sqlite3Clinet: done to get column names', rows)
    return rows.map((v) => ({
      field: v.name,
      type: v.type,
      null: v.notnull ? 'No' : 'Yes',
      default: v.dflt_value,
      comment: v.pk ? 'PRIMARY KEY' : '',
    }))
  }
}
