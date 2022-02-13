// SELECT U FROM (SELECT col1 FROM Users AS Use);

import { complete } from '../../src/complete'

const SIMPLE_SCHEMA = {
  tables: [
    {
      catalog: null,
      database: null,
      tableName: 'TABLE1',
      columns: [
        { columnName: 'COLUMN1', description: '' },
        { columnName: 'COLUMN2', description: '' }
      ]
    }
  ],
  functions: [
    {
      name: 'array_concat()',
      description: 'desc1'
    },
    {
      name: 'array_contains()',
      description: 'desc2'
    }
  ]
}

describe('TableName completion', () => {
  test("complete function keyword", () => {
    const result = complete('SELECT arr', { line: 0, column: 10 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('array_concat()')
    expect(result.candidates[1].label).toEqual('array_contains()')
  })

  test("complete function keyword", () => {
    const result = complete('SELECT ARR', { line: 0, column: 10 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('ARRAY_CONCAT()')
    expect(result.candidates[1].label).toEqual('ARRAY_CONTAINS()')
  })

  test("complete TableName", () => {
    const result = complete('SELECT T FROM TABLE1', { line: 0, column: 8 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('TABLE1')
  })

  test("complete alias", () => {
    const result = complete('SELECT ta FROM TABLE1 as tab', { line: 0, column: 9 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(1)
    expect(result.candidates[0].label).toEqual('tab')
  })
  test("complete SELECT star", () => {
    const result = complete('SELECT FROM TABLE1', { line: 0, column: 6 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('Select all columns from TABLE1')
    expect(result.candidates[0].insertText).toEqual('SELECT\nTABLE1.COLUMN1,\nTABLE1.COLUMN2')
    expect(result.candidates[1].label).toEqual('SELECT')
  })

  // This is difficult because we can't parse the statement to get
  // at the column names
  test.skip("complete partial SELECT star", () => {
    const result = complete('SELEC FROM TABLE1', { line: 0, column: 5 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('SELECT')
    expect(result.candidates[1].label).toEqual('Select all columns from TABLE1')
    expect(result.candidates[1].insertText).toEqual('SELECT\nTABLE1.COLUMN1,\nTABLE1.COLUMN2')
  })

  test("complete SELECT star passed select ", () => {
    const result = complete('SELECT  FROM TABLE1', { line: 0, column: 7 }, SIMPLE_SCHEMA)
    expect(result.candidates.length).toEqual(13)
    const expected = [
      expect.objectContaining({ label: 'Select all columns from TABLE1', insertText: 'TABLE1.COLUMN1,\nTABLE1.COLUMN2' }),
    ]
    expect(result.candidates).toEqual(expect.arrayContaining(expected))
  })
})
