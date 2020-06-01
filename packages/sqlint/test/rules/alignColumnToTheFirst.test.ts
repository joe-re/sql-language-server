import { execute } from '../../src/rules'

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
       foo.b
    FROM
      foo
  `
  const result = execute(sql, { rules: { 'align-column-to-the-first': { level: 2 } } })
  expect(result.length).toEqual(1)
  expect(result[0].message).toEqual("Columns must align to the first column.")
  expect(result[0].location).toEqual({
    start: {
      column: 8,
      line: 4,
      offset: 32
    },
    end: {
      column: 5,
      line: 5,
      offset: 42
    }
  })
})