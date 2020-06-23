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
      expect(result).toMatchObject({
        type: 'insert',
        table: 'employees'
      })
    })
  })

  describe('Select statement at value position', () => {
    it('should success to parse', () => {
      const sql = `
      INSERT INTO employees (payer_id, sarary, job_id)
      VALUES (
        (select payer_id from organizations where id='xxxxxxxxxxxxx'),
        50000,
        'xxxxxxxxxx'
      )
      `
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({
        type: 'insert',
        table: 'employees'
      })
      expect(result.values).toMatchObject({ type: 'values' })
      expect(result.values.values.length).toEqual(3)
      expect(result.values.values[0]).toMatchObject({ type: 'select' })
      expect(result.values.values[1]).toMatchObject({ type: 'number', value: 50000 })
      expect(result.values.values[2]).toMatchObject({ type: 'string', value: 'xxxxxxxxxx' })
    })
  })
})
