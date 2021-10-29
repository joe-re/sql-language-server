const { parse } = require('../index')

describe('Basic WITH statement', () => {
 it('should success to parse', () => {
    const sql = `
      WITH T2M AS (SELECT max(T2.num) as m from T2)
      SELECT *
      FROM T1
      WHERE T1.num = T2M.m
    `
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({ type: 'with' })
     expect(result.with[0].stmt).toMatchObject({ type: 'select' })
     expect(result.stmt.where.expression.left).toMatchObject({ type: 'column_ref' })
  })
})
