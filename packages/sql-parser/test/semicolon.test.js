const { parse } = require('../index')

describe('Does not have semicolon at end of sql', () => {
 it('should success to parse', () => {
    const sql = `
      SELECT *
      FROM T1
      WHERE T1.num = 1
    `
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({ type: 'select' })
  })
})
describe('Has semicolon at end of sql', () => {
 it('should success to parse', () => {
    const sql = `
      SELECT *
      FROM T1
      WHERE T1.num = 1;
    `
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({ type: 'select' })
  })
})