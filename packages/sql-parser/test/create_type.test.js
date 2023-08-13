const { parse } = require('../index')

// ref: https://www.postgresql.org/docs/current/sql-createtype.html
describe('CREATE TYPE statement', () => {
  describe('Composite Type', () => {
    it('should success to parse', () => {
      const sql = `CREATE TYPE compfoo AS (f1 int, f2 text);`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('create_type')
      expect(result.type_variant).toEqual('composite_type')
      expect(result.fields).toHaveLength(2)
      expect(result.fields[0].type).toEqual('composite_type_field')
      expect(result.fields[0].name).toEqual('f1')
      expect(result.fields[0].data_type.type).toEqual('field_data_type')
      expect(result.fields[0].data_type.name).toEqual('int')
      expect(result.fields[1].type).toEqual('composite_type_field')
      expect(result.fields[1].name).toEqual('f2')
      expect(result.fields[1].data_type.type).toEqual('field_data_type')
      expect(result.fields[1].data_type.name).toEqual('text')
    })
  })

  describe('Enumerated Types', () => {
    it('should success to parse', () => {
      const sql = `CREATE TYPE mood AS ENUM ('sad', 'ok', 'happy');`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('create_type')
      expect(result.type_variant).toEqual('enum_type')
      expect(result.values).toHaveLength(3)
      expect(result.values[0].value).toEqual('sad')
      expect(result.values[1].value).toEqual('ok')
      expect(result.values[2].value).toEqual('happy')
    })
  })

  describe('Range Types', () => {
    it('should success to parse', () => {
      const sql = `CREATE TYPE box AS RANGE (
        subtype = box,
        subtype_diff = box_subdiff,
        subtype_opclass = box_ops
      );`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('create_type')
      expect(result.type_variant).toEqual('range_type')
      expect(result.values).toHaveLength(3)
      expect(result.values[0].type).toEqual('assign_value_expr')
      expect(result.values[0].name).toEqual('subtype')
      expect(result.values[0].value).toEqual('box')
      expect(result.values[1].type).toEqual('assign_value_expr')
      expect(result.values[1].name).toEqual('subtype_diff')
      expect(result.values[1].value).toEqual('box_subdiff')
      expect(result.values[2].type).toEqual('assign_value_expr')
      expect(result.values[2].name).toEqual('subtype_opclass')
      expect(result.values[2].value).toEqual('box_ops')
    })
  })

  describe('Base Types', () => {
    it('should success to parse', () => {
      const sql = `CREATE TYPE mytype;`
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result.type).toEqual('create_type')
      expect(result.type_variant).toEqual('base_type')
      expect(result.values).toHaveLength(0)
    })

    describe('with attributes', () => {
      it('should success to parse', () => {
        const sql = `CREATE TYPE mytype (
          INPUT = myinputfunc,
          OUTPUT = myoutputfunc,
          RECEIVE = myreceivefunc,
          SEND = mysendfunc,
          TYPMOD_IN = mytypmodinfunc,
          TYPMOD_OUT = mytypmodoutfunc,
          ANALYZE = myanalyzefunc,
          INTERNALLENGTH = 42,
          PASSEDBYVALUE
        );`
        const result = parse(sql)
        expect(result).toBeDefined()
        expect(result.type).toEqual('create_type')
        expect(result.type_variant).toEqual('base_type')
        expect(result.values).toHaveLength(9)
        expect(result.values[0].type).toEqual('assign_value_expr')
        expect(result.values[0].name).toEqual('INPUT')
        expect(result.values[0].value).toEqual('myinputfunc')
        expect(result.values[1].type).toEqual('assign_value_expr')
        expect(result.values[1].name).toEqual('OUTPUT')
        expect(result.values[1].value).toEqual('myoutputfunc')
        expect(result.values[2].type).toEqual('assign_value_expr')
        expect(result.values[2].name).toEqual('RECEIVE')
        expect(result.values[2].value).toEqual('myreceivefunc')
        expect(result.values[3].type).toEqual('assign_value_expr')
        expect(result.values[3].name).toEqual('SEND')
        expect(result.values[3].value).toEqual('mysendfunc')
        expect(result.values[4].type).toEqual('assign_value_expr')
        expect(result.values[4].name).toEqual('TYPMOD_IN')
        expect(result.values[4].value).toEqual('mytypmodinfunc')
        expect(result.values[5].type).toEqual('assign_value_expr')
        expect(result.values[5].name).toEqual('TYPMOD_OUT')
        expect(result.values[5].value).toEqual('mytypmodoutfunc')
        expect(result.values[6].type).toEqual('assign_value_expr')
        expect(result.values[6].name).toEqual('ANALYZE')
        expect(result.values[6].value).toEqual('myanalyzefunc')
        expect(result.values[7].type).toEqual('assign_value_expr')
        expect(result.values[7].name).toEqual('INTERNALLENGTH')
        expect(result.values[7].value).toEqual(42)
        expect(result.values[8].type).toEqual('assign_value_expr')
        expect(result.values[8].name).toEqual('PASSEDBYVALUE')
        expect(result.values[8].value).toEqual(true)
      })
    })
  })
})
