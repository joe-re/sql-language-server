import { execute } from '../../src/rules'

test('valid case', () => {
  const sql = `
    SELECT foo.a, foo.b
    FROM foo
    WHERE
      foo.a = 'a'
      AND foo.b = 'b'
  `
  const result = execute(sql, { rules: { 'where-clause-new-line': { level: 2 } } })
  expect(result).toEqual([])
})


test('Multiple clauses must go on a new line', () => {
  const sql = `
    SELECT foo.a, foo.b
    FROM foo
    WHERE
      foo.a = 'a' AND foo.b = 'b'
  `
  const result = execute(sql, { rules: { 'where-clause-new-line': { level: 2 } } })
  expect(result.length).toEqual(1)
  expect(result[0].message).toEqual('Multiple where clause must go on a new line.')
  expect(result[0].location).toEqual({
    start: {
      column: 7,
      line: 5,
      offset: 54 
    },
    end: {
      column: 18,
      line: 5,
      offset: 65 
    }
  })
})