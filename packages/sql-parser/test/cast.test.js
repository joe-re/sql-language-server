const { parse } = require('../index')

describe('Cast function', () => {
  describe('in where clause', () => {
    it('should success to parse', () => {
      const sql = `
        SELECT "T1"."COL1"
        FROM "T1"
        WHERE CAST("T1"."num" as int) = 1
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('select')
      const cast = result.where.expression.left
      expect(cast).toMatchObject({
        type: 'cast_function',
	keyword: { type: 'keyword', value: 'CAST' },
        datatype: 'int',
        expr: { type: 'column_ref', table: 'T1', column: 'num' }
      })
    })
  })

  describe('in from clause', () => {
    it('should success to parse', () => {
      const sql = `
        SELECT "T1"."COL1"
        FROM "T1" INNER JOIN "T2" ON CAST("T1"."id" as int) = "T2"."id"
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('select')
      expect(result.from.tables).toHaveLength(2)
      const cast = result.from.tables[1].on.left
      expect(cast).toMatchObject({
        type: 'cast_function',
	keyword: { type: 'keyword', value: 'CAST' },
        datatype: 'int',
        expr: { type: 'column_ref', table: 'T1', column: 'id' }
      })
    })
  })
})
