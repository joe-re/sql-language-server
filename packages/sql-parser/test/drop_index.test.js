const { parse } = require('../index')

// https://www.postgresql.org/docs/current/sql-dropindex.html
describe('postgres DROP INDEX statement', () => {
  it('should success to parse', () => {
    const sql = `DROP INDEX index_name;`;
    const result = parse(sql)
    expect(result).toBeDefined()
    expect(result.type).toEqual('drop_index')
    expect(result.if_exists).toEqual(false)
    expect(result.concurrently).toEqual(false)
    expect(result.names).toHaveLength(1)
    expect(result.names[0]).toEqual('index_name')
  })

  describe('IF EXISTS', () => {
    it('should success to parse', () => {
      const sql = `DROP INDEX IF EXISTS index_name;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_index')
      expect(result.if_exists_keyword.type).toEqual('keyword')
      expect(result.if_exists_keyword.value).toEqual('IF EXISTS')
      expect(result.if_exists).toEqual(true)
      expect(result.names).toHaveLength(1)
      expect(result.names[0]).toEqual('index_name')
    })
  })

  describe('CONCURRENTLY', () => {
    it('should success to parse', () => {
      const sql = `DROP INDEX CONCURRENTLY index_name;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_index')
      expect(result.if_exists).toEqual(false)
      expect(result.concurrently_keyword.type).toEqual('keyword')
      expect(result.concurrently_keyword.value).toEqual('CONCURRENTLY')
      expect(result.concurrently).toEqual(true)
      expect(result.names).toHaveLength(1)
      expect(result.names[0]).toEqual('index_name')
    })
  })

  describe('CASCADE', () => {
    it('should success to parse', () => {
      const sql = `DROP INDEX index_name CASCADE;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_index')
      expect(result.if_exists).toEqual(false)
      expect(result.concurrently).toEqual(false)
      expect(result.dependency_action.type).toEqual('keyword')
      expect(result.dependency_action.value).toEqual('CASCADE')
      expect(result.names).toHaveLength(1)
      expect(result.names[0]).toEqual('index_name')
    })
  })

  describe('RESTRICT', () => {
    it('should success to parse', () => {
      const sql = `DROP INDEX index_name RESTRICT;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_index')
      expect(result.if_exists).toEqual(false)
      expect(result.concurrently).toEqual(false)
      expect(result.dependency_action.type).toEqual('keyword')
      expect(result.dependency_action.value).toEqual('RESTRICT')
      expect(result.names).toHaveLength(1)
      expect(result.names[0]).toEqual('index_name')
    })
  })

  describe('multiple indexes', () => {
    it('should success to parse', () => {
      const sql = `DROP INDEX index_name1, index_name2;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_index')
      expect(result.if_exists).toEqual(false)
      expect(result.concurrently).toEqual(false)
      expect(result.names).toHaveLength(2)
      expect(result.names[0]).toEqual('index_name1')
      expect(result.names[1]).toEqual('index_name2')
    })
  })
})
