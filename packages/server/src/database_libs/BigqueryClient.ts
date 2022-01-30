import { BigQuery } from '@google-cloud/bigquery'
import { Connection } from '../SettingStore'
import AbstractClient, { RawField } from './AbstractClient'

export default class BigqueryClient extends AbstractClient {
  connection: BigQuery | null = null

  constructor(settings: Connection) {
    super(settings)
  }

  get DefaultPort() { return 0 }
  get DefaultHost() { return '' }
  get DefaultUser() { return '' }

  connect() {
    this.connection = new BigQuery({
      keyFile: this.settings.keyFile ?? undefined,
      projectId: this.settings.projectId ?? undefined,
    })
    return true
  }

  disconnect() {
    this.connection = null
  }

  async getTables(): Promise<string[]> {
    const ds = this.connection!.dataset(this.settings.database!)!
    const [tables] = await ds.getTables()
    return tables.map((t) => t.metadata.id)
  }

  async getColumns(tableName: string): Promise<RawField[]> {
    const [meta] = await this.connection!
      .dataset(this.settings.database!)
      .table(tableName)
      .getMetadata()!
    return meta.schema.fields.map(
      (f: { name: string, type: string, mode: string }) => ({
        field: f.name,
        type: f.type,
        null: f.mode === 'NULLABLE' ? 'Yes' : 'No',
      })
    )
  }
}
