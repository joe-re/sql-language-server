import { execute } from '../../src/rules'
import { applyFixes } from '../testUtil'

test('valid case', () => {
  const sql = `
    SELECT
      foo.a,
      foo.b
    FROM
      foo
  `
  const result = execute(sql, { rules: { 'align-column-to-the-first': { level: 2 } } })
  expect(result).toEqual([])
})


test('Columns must align to the first column', () => {
  const sql = `
    SELECT
      foo.a,
        foo.b,
    foo.c
    FROM
      foo
  `
  const result = execute(sql, { rules: { 'align-column-to-the-first': { level: 2 } } })
  expect(result.length).toEqual(2)
  expect(result[0].message).toEqual("Columns must align to the first column.")
  expect(result[0].location).toEqual({
    start: { column: 9, line: 4, offset: 33 },
    end: { column: 14, line: 4, offset: 38 }
  })
  expect(result[1].message).toEqual("Columns must align to the first column.")
  expect(result[1].location).toEqual({
    start: { column: 5, line: 5, offset: 44},
    end: { column: 5, line: 6, offset: 54 }
  })
  const fixed = applyFixes(sql, result.map(v => v.fix!).flat())
  expect(fixed).toEqual(`
    SELECT
      foo.a,
      foo.b,
      foo.c
    FROM
      foo
  `)
})