import * as mysql from 'mysql'
import { Setting } from '../SettingStore'

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

  getSchema() {
    if (!this.connection) {
      throw new Error("Don't have database connection.")
    }
    const database = this.connection.config.database;
    if (!database) {
      throw new Error("No database selected.")
    }
    const sql = `
      SELECT table_name 
      FROM information_schema.tables
      WHERE table_schema = '${this.setting.database}'
    `
    this.connection.query(sql, (err, results) => {
      if (err) {
        throw new Error(err.message)
      }
      const tables = results.map((v: any) => v[`table_name`])
      console.log(JSON.stringify(tables))
    })
    this.connection.end()
  }
}
