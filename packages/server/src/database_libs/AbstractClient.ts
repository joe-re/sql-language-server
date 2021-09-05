import { Connection } from '../SettingStore'
import log4js from 'log4js';
import { SSHConnection } from 'node-ssh-forward'
import { readFileSync } from 'fs'

const logger = log4js.getLogger()

export type RawField = {
  field: string,
  type: string,
  null: 'Yes' | 'No',
  default: any,
  comment: string
}
export type Column = {
  columnName: string,
  description: string
}
export type Table = {
  catalog: string | null,
  database: string | null,
  tableName: string,
  columns: Column[]
}
export type DbFunction = {
  name: string,
  description: string,
}

export type Schema = {
  tables: Table[],
  functions: DbFunction[]
}

export default abstract class AbstractClient {
  connection: any

  constructor(protected settings: Connection) {}

  abstract connect(): Promise<boolean> | boolean
  abstract disconnect(): void
  abstract getTables(): Promise<string[]>
  abstract getColumns(tableName: string): Promise<RawField[]>
  abstract DefaultPort: number
  abstract DefaultHost: string
  abstract DefaultUser: string

  async getSchema(): Promise<Schema> {
    let schema: Schema = {tables:[], functions: []}
    const sshConnection =
      this.settings.ssh?.remoteHost ? new SSHConnection({
        endHost: this.settings.ssh.remoteHost,
        username: this.settings.ssh.user,
        privateKey: readFileSync(this.settings.ssh.identityFile || `${process.env.HOME}/.ssh/id_rsa`),
        passphrase: this.settings.ssh.passphrase || ''
      }) : null
    if (sshConnection) {
      await sshConnection.forward({
        fromPort: this.settings.port || this.DefaultPort,
        toPort: this.settings.ssh?.dbPort || this.DefaultPort,
        toHost: this.settings.ssh?.dbHost || '127.0.0.1'
      }).then(v => {
        if (v) {
          logger.error('Failed to ssh remote server')
          logger.error(v)
        }
        return []
      })
    }
    if (!(await this.connect())) {
      logger.error('AbstractClinet.getSchema: failed to connect database')
      return {tables:[], functions: []}
    }
    try {
      const tables = await this.getTables()
      schema.tables = await Promise.all(
        tables.map((v) => this.getColumns(v).then(columns => ({
          catalog: null,
          database: this.settings.database,
          tableName: v,
          columns: columns.map(v => this.toColumnFromRawField(v)) }
        )))
      )
    } catch (e) {
      logger.error(e)
      throw e
    } finally {
      this.disconnect()
      if (sshConnection) {
        sshConnection.shutdown()
      }
    }
    return schema
  }

  private toColumnFromRawField(field: RawField): Column {
    return {
      columnName: field.field,
      description: `${field.field}(Type: ${field.type}, Null: ${field.null}, Default: ${field.default})`
    }
  }
}
