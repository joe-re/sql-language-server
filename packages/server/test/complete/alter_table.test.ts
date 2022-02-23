import { complete } from '../../src/complete'

describe('complete ALTER TABLE statement', () => {
  describe('keyword completion', () => {
    test("complete 'CREATE TABLE' keyword", () => {
      const sql = 'A'
      const result = complete(sql, { line: 0, column: sql.length })
      expect(result.candidates.length).toEqual(1)
      expect(result.candidates[0].label).toEqual('ALTER TABLE')
    })
  })
})
