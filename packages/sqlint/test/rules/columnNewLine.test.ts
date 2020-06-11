import { execute } from '../../src/rules'
import { applyFixes } from '../testUtil'

test('valid case', () => {
  const sqls = [
  'SELECT * from foo',
  `
   SELECT foo.a
   FROM foo
  `,
  `
    SELECT
      foo.a,
      foo.b
    FROM
      foo
  `,
  ]
  sqls.forEach(v => {
    const result = execute(v, { rules: { 'column-new-line':  { level: 2 } } })
    expect(result).toEqual([])
  })
})

test("Columns must go on a new line", () => {
  const sql = `
    SELECT
      foo.a , foo.b , foo.c , foo.d
    FROM
      foo
  `;
  const result = execute(sql, { rules: { 'column-new-line':  { level: 2 } } })
  expect(result.length).toEqual(3)
  expect(result[0].message).toEqual("Columns must go on a new line.")
  expect(result[0].location).toEqual({
    start: { column: 15, line: 3, offset: 26 },
    end: { column: 21, line: 3, offset: 32 }
  })
  expect(result[1].message).toEqual("Columns must go on a new line.")
  expect(result[1].location).toEqual({
    start: { column: 23, line: 3, offset: 34 },
    end: { column: 29, line: 3, offset: 40 }
  })
  const fixed = applyFixes(sql, result.map(v => v.fix!))
  console.log(fixed)
  expect(fixed).toEqual(`
    SELECT
      foo.a ,
      foo.b ,
      foo.c ,
      foo.d
    FROM
      foo
  `)
})