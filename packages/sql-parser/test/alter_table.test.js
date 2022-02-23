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
        command: {
          type: 'alter_table_add_column',
          field: {
            type: 'field',
            name: 'Email',
            data_type: { name: 'varchar', value: '255' },
          },
        },
      })
    })
  })

  describe('drop column', () => {
    it('should success to parse', () => {
      const sql = `ALTER TABLE Customers DROP COLUMN Email;`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'alter_table',
        keyword: {
          type: 'keyword',
          value: 'ALTER TABLE',
        },
        command: {
          type: 'alter_table_drop_column',
          column: 'Email',
        },
      })
    })
  })

  describe('modify column', () => {
    describe('modify column keyword', () => {
      it('should success to parse', () => {
        const sql = `ALTER TABLE Customers MODIFY COLUMN Email varchar(255);`
        const result = parse(sql)
        expect(result).toBeDefined()
        expect(result).toMatchObject({
          type: 'alter_table',
          keyword: {
            type: 'keyword',
            value: 'ALTER TABLE',
          },
          command: {
            type: 'alter_table_modify_column',
            keyword: {
              type: 'keyword',
              value: 'MODIFY COLUMN',
            },
            field: {
              type: 'field',
              name: 'Email',
              data_type: { name: 'varchar', value: '255' },
            },
          },
        })
      })
    })

    describe('modify keyword', () => {
      it('should success to parse', () => {
        const sql = `ALTER TABLE Customers MODIFY Email varchar(255);`
        const result = parse(sql)
        expect(result).toBeDefined()
        expect(result).toMatchObject({
          type: 'alter_table',
          keyword: {
            type: 'keyword',
            value: 'ALTER TABLE',
          },
          command: {
            type: 'alter_table_modify_column',
            keyword: {
              type: 'keyword',
              value: 'MODIFY',
            },
            field: {
              type: 'field',
              name: 'Email',
              data_type: { name: 'varchar', value: '255' },
            },
          },
        })
      })
    })

    describe('alter column keyword', () => {
      it('should success to parse', () => {
        const sql = `ALTER TABLE Customers ALTER COLUMN Email varchar(255);`
        const result = parse(sql)
        expect(result).toBeDefined()
        expect(result).toMatchObject({
          type: 'alter_table',
          keyword: {
            type: 'keyword',
            value: 'ALTER TABLE',
          },
          command: {
            type: 'alter_table_modify_column',
            keyword: {
              type: 'keyword',
              value: 'ALTER COLUMN',
            },
            field: {
              type: 'field',
              name: 'Email',
              data_type: { name: 'varchar', value: '255' },
            },
          },
        })
      })
    })
  })
})
