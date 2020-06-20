const { parse } = require('../index')

describe('SingleLineComment', () => {
 it('should success to parse', () => {
    const sql = `
      SELECT * -- Single line comment here
      FROM T1
      WHERE T1.name = 1
    `
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({ type: 'select' })
  })
})

describe('MultiLineComment', () => {
 it('should success to parse', () => {
    const sql = `
      SELECT *
      /*
        Multi line comment here
      */
      FROM T1
      WHERE T1.name = 1
    `
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({ type: 'select' })
  })
})