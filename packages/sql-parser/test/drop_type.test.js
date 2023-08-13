const { parse } = require('../index')

// https://www.postgresql.org/docs/current/sql-droptype.html
describe('DROP TYPE statement', () => {
  it('should success to parse', () => {
    const sql = `DROP TYPE mood;`;
    const result = parse(sql)
    expect(result).toBeDefined()
    expect(result.type).toEqual('drop_type')
    expect(result.names).toHaveLength(1)
    expect(result.names[0]).toEqual('mood')
  })

  describe('IF EXISTS', () => {
    it('should success to parse', () => {
      const sql = `DROP TYPE IF EXISTS mood;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_type')
      expect(result.if_exists.type).toEqual('keyword')
      expect(result.if_exists.value).toEqual('IF EXISTS')
      expect(result.names).toHaveLength(1)
      expect(result.names[0]).toEqual('mood')
    })
  })

  describe('CASCADE', () => {
    it('should success to parse', () => {
      const sql = `DROP TYPE mood CASCADE;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_type')
      expect(result.dependency_action.type).toEqual('keyword')
      expect(result.dependency_action.value).toEqual('CASCADE')
      expect(result.names).toHaveLength(1)
      expect(result.names[0]).toEqual('mood')
    })
  })

  describe('RESTRICT', () => {
    it('should success to parse', () => {
      const sql = `DROP TYPE mood RESTRICT;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_type')
      expect(result.dependency_action.type).toEqual('keyword')
      expect(result.dependency_action.value).toEqual('RESTRICT')
      expect(result.names).toHaveLength(1)
      expect(result.names[0]).toEqual('mood')
    })
  })

  describe('multiple types', () => {
    it('should success to parse', () => {
      const sql = `DROP TYPE mood, box;`;
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('drop_type')
      expect(result.names).toHaveLength(2)
      expect(result.names[0]).toEqual('mood')
      expect(result.names[1]).toEqual('box')
    })
  })
})