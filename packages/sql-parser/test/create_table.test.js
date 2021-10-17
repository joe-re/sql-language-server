const { parse } = require('../index')

describe('Basic CREATE TABLE statement', () => {
 it('should success to parse', () => {
    const sql = `CREATE TABLE Persons (
  PersonID int,
  LastName varchar(255)
);`
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({
       type: 'create_table',
       keyword: {
         type: 'keyword',
         value: 'CREATE TABLE'
       },
       fields: [
         { type: 'field', name: 'PersonID', data_type: { name: 'int', value: null } },
         { type: 'field', name: 'LastName', data_type: { name: 'varchar', value: '255' } }
       ]
     })
  })
})