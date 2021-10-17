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
        if_not_exist: null,
        fields: [
          { type: 'field', name: 'PersonID', data_type: { name: 'int', value: null } },
          { type: 'field', name: 'LastName', data_type: { name: 'varchar', value: '255' } }
        ]
      })
    })
  })


  describe('With IF NOT EXIST', () => {
    it('should success to parse', () => {
      const sql = `CREATE TABLE IF NOT EXIST Persons ( PersonID int, LastName varchar(255));`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'create_table',
        keyword: {
          type: 'keyword',
          value: 'CREATE TABLE'
        },
        if_not_exist: {
          type: 'keyword',
          value: 'IF NOT EXIST'
        },
        fields: [
          { type: 'field', name: 'PersonID', data_type: { name: 'int', value: null } },
          { type: 'field', name: 'LastName', data_type: { name: 'varchar', value: '255' } }
        ]
      })
    })
  })
})