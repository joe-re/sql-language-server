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

describe('ColumnName completion', () => {
  test('complete column name', () => {
    const result = complete(
      'SELECT COL FROM TABLE1',
      { line: 0, column: 10 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(0)
  })

  test('complete ColumnName', () => {
    const result = complete(
      'SELECT TABLE1.C FROM TABLE1',
      { line: 0, column: 15 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    const expected = [
      expect.objectContaining({ label: 'COLUMN1' }),
      expect.objectContaining({ label: 'COLUMN2' }),
    ]
    expect(result.candidates).toEqual(expect.arrayContaining(expected))
  })

  test('complete ColumnName with previous back tick column', () => {
    const result = complete(
      'SELECT `COLUMN2`, TABLE1.C FROM TABLE1',
      { line: 0, column: 26 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })

  test('complete ColumnName: cursor on dot', () => {
    const result = complete(
      'SELECT TABLE1. FROM TABLE1',
      { line: 0, column: 14 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })

  test('complete ColumnName:cursor on dot:multi line', () => {
    const result = complete(
      'SELECT *\nFROM TABLE1\nWHERE TABLE1.',
      { line: 2, column: 13 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })

  test('complete ColumnName:cursor on dot:using alias', () => {
    const result = complete(
      'SELECT *\nFROM TABLE1 t\nWHERE t.',
      { line: 2, column: 8 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })

  test('complete ColumnName:cursor on dot:using alias', () => {
    const result = complete(
      'SELECT t. FROM TABLE1 as t',
      { line: 0, column: 9 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })

  test('complete ColumnName:cursor on first char:using alias', () => {
    const result = complete(
      'SELECT t.C FROM TABLE1 as t',
      { line: 0, column: 10 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })

  test('complete ColumnName:cursor on first char:using back tick', () => {
    const result = complete(
      'SELECT `t`.C FROM TABLE1 as t',
      { line: 0, column: 12 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(0)
  })

  test('complete ColumnName with back quoted table', () => {
    const result = complete(
      'SELECT "TABLE1". FROM "TABLE1"',
      { line: 0, column: 16 },
      SIMPLE_SCHEMA
    )
    expect(result.candidates.length).toEqual(2)
    expect(result.candidates[0].label).toEqual('COLUMN1')
    expect(result.candidates[1].label).toEqual('COLUMN2')
  })
})
