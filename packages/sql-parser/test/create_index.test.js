const { parse } = require('../index')

describe('CREATE INDEX statement', () => {
  describe('basic statement', () => {
    it('should success to parse', () => {
      const sql = `CREATE INDEX index_mac_address ON devices(mac_address);`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('create_index')
      expect(result.name).toEqual('index_mac_address')
      expect(result.table).toEqual('devices')
      expect(result.columns).toEqual(['mac_address'])
      expect(result.if_not_exists).toEqual(false)
    })
  })

  describe('if not exists', () => {
    it('should success to parse', () => {
      const sql = `CREATE INDEX IF NOT EXISTS index_mac_address ON devices(mac_address);`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('create_index')
      expect(result.name).toEqual('index_mac_address')
      expect(result.table).toEqual('devices')
      expect(result.columns).toEqual(['mac_address'])
      expect(result.if_not_exists).toEqual(true)
    })
  })
})
