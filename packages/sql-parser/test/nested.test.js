const { parse } = require('../index')

describe('nested columns', () => {
  it('column name y.z should success to parse', () => {
    const sql = '\
      SELECT\
      tab1.col1,\
      tab1.y.z,\
      a.b.c \
      FROM T1 as tab1 \
    '
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({ type: 'select' })
     expect(result.columns[0].expr).toMatchObject({ column: 'col1', table: 'tab1', type: 'column_ref' })
     expect(result.columns[1].expr).toMatchObject({ column: 'y.z', table: 'tab1', type: 'column_ref' })
     expect(result.columns[2].expr).toMatchObject({ column: 'b.c', table: 'a', type: 'column_ref' })
  })

  it('incomplete column name should fail', () => {
      const t = () => {
        const sql = '\
        SELECT tab1. \
        FROM T1 as tab1 \
      '
       const result = parse(sql)
      };
      expect(t).toThrow();
   })
 
   it('back ticked columns success to parse', () => {
     const sql = '\
       SELECT \
       `tab1.y.z`,\
       tab1.`col1`.`sub1`,\
       `nestedwithspaces`.`sub field`.`sub field2`\
       FROM T1 as tab1 \
     '
      const result = parse(sql)
      expect(result).toBeDefined()
      expect(result).toMatchObject({ type: 'select' })
      // This is not technically correct since it does not detect the table
      expect(result.columns[0].expr).toMatchObject({ column: '`tab1.y.z`', table: '', type: 'column_ref' })
      expect(result.columns[1].expr).toMatchObject({ column: '`col1`.`sub1`', table: 'tab1', type: 'column_ref' })
      expect(result.columns[2].expr).toMatchObject({ column: '`sub field`.`sub field2`', table: 'nestedwithspaces', type: 'column_ref' })
   })
 
   it('column ref using subscript (array, map)', () => {
    const sql = `
      SELECT
        array_col[4],
        T1.map_col['key']
      FROM T1 as tab1
    `
     const result = parse(sql)
     expect(result).toBeDefined()
     expect(result).toMatchObject({ type: 'select' })
     // This is not technically correct since it does not detect the table
     expect(result.columns[0].expr).toMatchObject({ column: 'array_col[4]', table: '', type: 'column_ref' })
     expect(result.columns[1].expr).toMatchObject({ column: "map_col['key']", table: 'T1', type: 'column_ref' })
  })

})