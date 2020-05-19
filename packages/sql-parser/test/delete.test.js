const { parse } = require('../index')

describe('Badic DELETE syayement', () => {
 it('should success to parse', () => {
    const sql = `
      DELETE FROM T1
      WHERE T1.name = 1
    `
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({
       type: 'delete',
       table: {
         location: {},
         type: 'table',
         table: 'T1'
       },
       where: {}
     })
  })
})