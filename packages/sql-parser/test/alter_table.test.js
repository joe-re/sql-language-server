const { parse } = require('../index')

describe('ALTER TABLE statement', () => {
  describe('add column', () => {
    it('should success to parse', () => {
      const sql = `ALTER TABLE Customers ADD Email varchar(255);`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'alter_table',
        keyword: {
          type: 'keyword',
          value: 'ALTER TABLE',
        },
        add: {
          type: 'alter_table_add',
          field: {
            type: 'field',
            name: 'Email',
            data_type: { name: 'varchar', value: "255" },
          },
        },
      })
    })
  })
})
