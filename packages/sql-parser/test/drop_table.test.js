const { parse } = require('../index')

describe('DROP TABLE statement', () => {
  describe('Basic statement', () => {
    it('should success to parse', () => {
      const sql = `DROP TABLE Persons;`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'drop_table',
        if_exists: null,
        keyword: {
          type: 'keyword',
          value: 'DROP TABLE'
        },
        table: {
          type: 'table',
          table: 'Persons',
        }
      })
    })
  })

  describe('With IF EXISTS', () => {
    it('should success to parse', () => {
      const sql = `DROP TABLE IF EXISTS Persons;`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'drop_table',
        keyword: {
          type: 'keyword',
          value: 'DROP TABLE'
        },
        if_exists: {
          type: 'keyword',
          value: 'IF EXISTS'
        },
        table: {
          type: 'table',
          table: 'Persons',
        }
      })
    })
  })
})
