const { parse, parseFromClause } = require('../index')

describe('Subquery in where clause', () => {
  it('should success to parse', () => {
    const sql = `
      SELECT *
      FROM T1
      WHERE T1.num = (SELECT max(T2.num) from T2)
    `
    const result = parse(sql)
    expect(result).toBeDefined()
    expect(result).toMatchObject({ type: 'select' })
    expect(result.where.expression.left).toMatchObject({ type: 'column_ref' })
    expect(result.where.expression.right).toMatchObject({ type: 'select' })
  })

  it('should not accept WHERE as an alias', () => {
    const sql = `
      SELECT *
      FROM T1
      WHERE T1.num = (SELECT max(T2.num) from T2)
    `
    const result = parse(sql)
    expect(result).toBeDefined()
    expect(result).toMatchObject({ type: 'select' })
    expect(result.from.tables[0]).toMatchObject({ as: null, table: 'T1' })
  })

  it('should not accept WHERE as an alias in parseFromClause', () => {
    const sql = `SELECT * FROM T1 WHERE T1.`
    const result = parseFromClause(sql)
    expect(result).toBeDefined()
    expect(result.from.tables[0]).toMatchObject({ as: null, table: 'T1' })
  })
})