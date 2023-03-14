const { parse } = require('../index')

// ref: https://github.com/vitaly-t/pg-promise
describe('Includes ${KEY} on a query', () => {
  it('should success to parse', () => {
    const sql = "INSERT INTO documents(id, doc) VALUES(${id}, ${this})"
    const result = parse(sql)
    expect(result).toBeDefined()
    expect(result.type).toEqual('insert')
    expect(result.values.values.length).toEqual(2)
    const v = result.values.values
    expect(v[0].type).toEqual('var_pg_promise')
    expect(v[0].name).toEqual('id')
    expect(v[1].type).toEqual('var_pg_promise')
    expect(v[1].name).toEqual('this')
  })
})
