import mysql from 'mysql2/promise'
import MysqlClient from '../../src/database_libs/MysqlClient'
import { settingsFromUrl } from './helpers'

const url = process.env.SQLLS_TEST_MYSQL

describe.skipIf(!url)('MysqlClient', () => {
  beforeAll(async () => {
    const connection = await mysql.createConnection({
      uri: url,
      multipleStatements: true,
    })
    await connection.query(`
      DROP TABLE IF EXISTS users, \`weird\`\`name\`;
      CREATE TABLE users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) DEFAULT 'none' COMMENT 'contact address'
      );
      CREATE TABLE \`weird\`\`name\` (value DOUBLE);
    `)
    await connection.end()
  })

  it('should read tables and columns', async () => {
    const schema = await new MysqlClient(
      settingsFromUrl('mysql', url!)
    ).getSchema()
    expect(schema.tables.map((v) => v.tableName).sort()).toEqual([
      'users',
      'weird`name',
    ])
    const users = schema.tables.find((v) => v.tableName === 'users')
    expect(users?.columns).toEqual([
      {
        columnName: 'id',
        description: 'id(Type: int, Null: No, Default: null)',
      },
      {
        columnName: 'name',
        description: 'name(Type: varchar(255), Null: No, Default: null)',
      },
      {
        columnName: 'email',
        description: 'email(Type: varchar(255), Null: Yes, Default: none)',
      },
    ])
    const weird = schema.tables.find((v) => v.tableName === 'weird`name')
    expect(weird?.columns.map((v) => v.columnName)).toEqual(['value'])
  })

  it('should reject when the server is unreachable', async () => {
    const settings = settingsFromUrl('mysql', url!)
    settings.port = 1
    await expect(new MysqlClient(settings).getSchema()).rejects.toThrow()
  })
})
