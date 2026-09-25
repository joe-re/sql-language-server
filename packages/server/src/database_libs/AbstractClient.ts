import log4js from 'log4js'
import { Connection } from '../SettingStore'
import { openSshTunnel, SshTunnel } from './sshTunnel'

const logger = log4js.getLogger()

export type RawField = {
  field: string
  type: string
  null: 'Yes' | 'No'
  default: string
  comment: string
}
export type Column = {
  columnName: string
  description: string
}
export type Table = {
  catalog: string | null
  database: string | null
  tableName: string
  columns: Column[]
}
export type DbFunction = {
  name: string
  description: string
}

export type Schema = {
  tables: Table[]
  functions: DbFunction[]
}

export default abstract class AbstractClient {
  connection: unknown

  constructor(protected settings: Connection) {}

  abstract connect(): Promise<boolean> | boolean
  abstract disconnect(): void
  abstract getTables(): Promise<string[]>
  abstract getColumns(tableName: string): Promise<RawField[]>
  abstract DefaultPort: number
  abstract DefaultHost: string
  abstract DefaultUser: string

  async getSchema(): Promise<Schema> {
    const schema: Schema = { tables: [], functions: [] }
    // The database client connects to settings.host:settings.port, which is
    // expected to point at the local end of the tunnel (usually 127.0.0.1)
    const sshTunnel: SshTunnel | null = this.settings.ssh?.remoteHost
      ? await openSshTunnel(
          this.settings.ssh,
          this.settings.port || this.DefaultPort,
          this.settings.ssh.dbPort || this.DefaultPort
        )
      : null
    try {
      if (!(await this.connect())) {
        logger.error('AbstractClinet.getSchema: failed to connect database')
        return { tables: [], functions: [] }
      }
      const tables = await this.getTables()
      schema.tables = await Promise.all(
        tables.map((v) =>
          this.getColumns(v).then((columns) => ({
            catalog: null,
            database: this.settings.database,
            tableName: v,
            columns: columns.map((v) => this.toColumnFromRawField(v)),
          }))
        )
      )
    } catch (e) {
      logger.error(e)
      throw e
    } finally {
      this.disconnect()
      sshTunnel?.close()
    }
    return schema
  }

  private toColumnFromRawField(field: RawField): Column {
    return {
      columnName: field.field,
      description: `${field.field}(Type: ${field.type}, Null: ${field.null}, Default: ${field.default})`,
    }
  }
}
