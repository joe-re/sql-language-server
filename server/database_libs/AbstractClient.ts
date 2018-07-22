import { Settings } from '../SettingStore'
import * as log4js from 'log4js';

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
  database: string | null,
  tableName: string,
  columns: Column[]
}
export type Schema = Table[]
export default abstract class AbstractClient {
  connection: any

  constructor(protected settings: Settings) {}

  abstract connect(): void
  abstract disconnect(): void
  abstract getTables(): Promise<string[]>
  abstract getColumns(tableName: string): Promise<RawField[]>

  async getSchema(): Promise<Schema> {
    this.connect()
    let schema: Schema = []
    try {
      const tables = await this.getTables()
      schema = await Promise.all(
        tables.map((v) => this.getColumns(v).then(columns => ({
          database: this.settings.database,
          tableName: v,
          columns: columns.map(v => this.toColumnFromRawField(v)) }
        )))
      )
    } catch (e) {
      logger.error(e)
    }
    this.disconnect()
    return schema
  }

  private toColumnFromRawField(field: RawField): Column {
    return {
      columnName: field.field,
      description: `${field.field}(Type: ${field.type}, Null: ${field.null}, Default: ${field.default})`
    }
  }
}
