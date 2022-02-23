import { complete } from '../../src/complete'

const SIMPLE_SCHEMA = {
  tables: [
    {
      catalog: null,
      database: null,
      tableName: 'TABLE1',
      columns: [
        { columnName: 'COLUMN1', description: '' },
        { columnName: 'COLUMN2', description: '' },
      ],
    },
  ],
  functions: [
    {
      name: 'array_concat()',
      description: 'desc1',
    },
    {
      name: 'array_contains()',
      description: 'desc2',
    },
  ],
}

describe('complete ALTER TABLE statement', () => {
  describe('keyword completion', () => {
    it("completes 'ALTER TABLE' keyword", () => {
      const sql = 'A'
      const result = complete(sql, { line: 0, column: sql.length })
      expect(result.candidates.length).toEqual(1)
      expect(result.candidates[0].label).toEqual('ALTER TABLE')
    })

    it("completes 'ALTER COLUMN' keyword", () => {
      const sql = 'ALTER TABLE Customers ALTE'
      const result = complete(sql, { line: 0, column: sql.length })
      expect(result.candidates.length).toEqual(1)
      expect(result.candidates[0].label).toEqual('ALTER COLUMN')
    })
  })

  describe('Table name completion', () => {
    it('completes table name', () => {
      const sql = 'ALTER TABLE T'
      const result = complete(
        sql,
        { line: 0, column: sql.length },
        SIMPLE_SCHEMA
      )
      expect(result.candidates.length).toEqual(1)
      expect(result.candidates[0].label).toEqual('TABLE1')
      expect(result.candidates[0].insertText).toEqual('TABLE1')
    })
  })

  describe('Column name completion', () => {
    // TODO: Deal with column completion
    it.skip('completes column name', () => {
      const sql = 'ALTER TABLE TABLE1 MODIFY C'
      const result = complete(
        sql,
        { line: 0, column: sql.length },
        SIMPLE_SCHEMA
      )
      expect(result.candidates.length).toEqual(2)
      expect(result.candidates[0].label).toEqual('COLUMN1')
      expect(result.candidates[0].insertText).toEqual('COLUMN1')
    })
  })
})
