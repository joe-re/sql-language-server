const { parse } = require('../index')

describe('Insert statement', () => {
  describe('Basic statement', () => {
    it('should success to parse', () => {
      const sql = `
      INSERT INTO employees (payer_id, sarary, job_id)
      VALUES (
        50000,
        'xxxxxxxxxx'
      )
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      console.log(result)
      expect(result).toMatchObject({
        type: 'insert',
        table: 'employees'
      })
    })
  })

//   describe('Select statement at value position', () => {
    // it('should success to parse', () => {
    //   const sql = `
    //   INSERT INTO employees (payer_id, sarary, job_id)
    //   VALUES (
        // 50000,
        // 'xxxxxxxxxx'
    //   )
    //   `
    //   try {
        // parse(sql)
    //   } catch(e) {
        // console.log(e)
    //   }
    //   const result = parse(sql)
    //   expect(result).toBeDefined()
    //   expect(result).toMatchObject({
        // type: 'delete',
        // table: {
        //   location: {},
        //   type: 'table',
        //   table: 'T1'
        // },
        // where: {}
    //   })
    // })
//   })
})
