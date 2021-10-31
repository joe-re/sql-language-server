const { parse } = require('../index')

describe('CREATE TABLE statement', () => {
  describe('Basic statement', () => {
    it('should success to parse', () => {
      const sql = `CREATE TABLE Persons ( PersonID int, LastName varchar(255));`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'create_table',
        keyword: {
          type: 'keyword',
          value: 'CREATE TABLE'
        },
        if_not_exists: null,
        fields: [
          { type: 'field', name: 'PersonID', data_type: { name: 'int', value: null } },
          { type: 'field', name: 'LastName', data_type: { name: 'varchar', value: '255' } }
        ]
      })
    })
  })


  describe('With IF NOT EXIST', () => {
    it('should success to parse', () => {
      const sql = `CREATE TABLE IF NOT EXISTS Persons ( PersonID int, LastName varchar(255));`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'create_table',
        keyword: {
          type: 'keyword',
          value: 'CREATE TABLE'
        },
        if_not_exists: {
          type: 'keyword',
          value: 'IF NOT EXISTS'
        },
        fields: [
          { type: 'field', name: 'PersonID', data_type: { name: 'int', value: null } },
          { type: 'field', name: 'LastName', data_type: { name: 'varchar', value: '255' } }
        ]
      })
    })
  })

  describe('Constraints', () => {
    it('should success to parse', () => {
      const sql = `
        CREATE TABLE Persons (
          PersonID int NOT NULL UNIQUE PRIMARY KEY,
          LastName varchar(255)
        );`
      const result = parse(sql)
      expect(result.fields[0].constraints).toBeDefined()
      expect(result.fields[0].constraints.length).toEqual(3)
      expect(result.fields[0].constraints[0].type).toEqual('constraint_not_null')
      expect(result.fields[0].constraints[1].type).toEqual('constraint_unique')
      expect(result.fields[0].constraints[2].type).toEqual('constraint_primary_key')
    })
  })

  describe('Using another table', () => {
    it('should success to parse', () => {
      const sql = `
        CREATE TABLE TestTable AS
        SELECT customername, contactname
        FROM customers;
      `
      const result = parse(sql)
      expect(result).toBeDefined()
    })
  })
})