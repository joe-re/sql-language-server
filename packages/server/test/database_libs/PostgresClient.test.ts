import PG from 'pg'
import PostgresClient from '../../src/database_libs/PostgresClient'
import { settingsFromUrl } from './helpers'

const url = process.env.SQLLS_TEST_POSTGRES

describe.skipIf(!url)('PostgresClient', () => {
  beforeAll(async () => {
    const client = new PG.Client({ connectionString: url })
    await client.connect()
    await client.query(`
      DROP TABLE IF EXISTS users, "Mixed Case";
      CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT DEFAULT 'none');
      COMMENT ON COLUMN users.email IS 'contact address';
      CREATE TABLE "Mixed Case" (value REAL);
    `)
    await client.end()
  })

  it('should read tables and columns', async () => {
    const schema = await new PostgresClient(
      settingsFromUrl('postgres', url!)
    ).getSchema()
    expect(schema.tables.map((v) => v.tableName).sort()).toEqual([
      'Mixed Case',
      'users',
    ])
    const users = schema.tables.find((v) => v.tableName === 'users')
    expect(users?.columns).toEqual([
      {
        columnName: 'id',
        description:
          "id(Type: integer, Null: No, Default: nextval('users_id_seq'::regclass))",
      },
      {
        columnName: 'name',
        description: 'name(Type: text, Null: No, Default: null)',
      },
      {
        columnName: 'email',
        description: "email(Type: text, Null: Yes, Default: 'none'::text)",
      },
    ])
    const mixed = schema.tables.find((v) => v.tableName === 'Mixed Case')
    expect(mixed?.columns.map((v) => v.columnName)).toEqual(['value'])
  })

  it('should reject when the server is unreachable', async () => {
    const settings = settingsFromUrl('postgres', url!)
    settings.port = 1
    await expect(new PostgresClient(settings).getSchema()).rejects.toThrow()
  })
})
