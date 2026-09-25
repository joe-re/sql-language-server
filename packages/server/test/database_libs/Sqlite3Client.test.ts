import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { DatabaseSync } from 'node:sqlite'
import Sqlite3Client, {
  Sqlite3OpenError,
} from '../../src/database_libs/Sqlite3Client'
import { createSettings as createBaseSettings } from './helpers'

function createSettings(filename: string | null) {
  return createBaseSettings({ adapter: 'sqlite3', filename })
}

describe('Sqlite3Client', () => {
  let dir: string
  let filename: string

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sqlls-sqlite3-'))
    filename = path.join(dir, 'test.sqlite3')
    const db = new DatabaseSync(filename)
    db.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT DEFAULT 'none');
      CREATE TABLE "weird'name" (value REAL);
    `)
    db.close()
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should read tables and columns', async () => {
    const schema = await new Sqlite3Client(createSettings(filename)).getSchema()
    expect(schema.tables.map((v) => v.tableName).sort()).toEqual([
      'users',
      "weird'name",
    ])
    const users = schema.tables.find((v) => v.tableName === 'users')
    expect(users?.columns).toEqual([
      {
        columnName: 'id',
        description: 'id(Type: INTEGER, Null: Yes, Default: null)',
      },
      {
        columnName: 'name',
        description: 'name(Type: TEXT, Null: No, Default: null)',
      },
      {
        columnName: 'email',
        description: "email(Type: TEXT, Null: Yes, Default: 'none')",
      },
    ])
    const weird = schema.tables.find((v) => v.tableName === "weird'name")
    expect(weird?.columns.map((v) => v.columnName)).toEqual(['value'])
  })

  it('should throw Sqlite3OpenError when the file cannot be opened', async () => {
    const client = new Sqlite3Client(
      createSettings(path.join(dir, 'missing', 'db.sqlite3'))
    )
    await expect(client.getSchema()).rejects.toBeInstanceOf(Sqlite3OpenError)
  })

  it('should require filename', () => {
    expect(() => new Sqlite3Client(createSettings(null)).connect()).toThrow(
      'Need to specify filename'
    )
  })
})
