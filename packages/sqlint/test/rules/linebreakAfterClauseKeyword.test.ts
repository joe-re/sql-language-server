import { execute } from '../../src/rules'

test('valid case', () => {
  const sql = `
    SELECT
      *
    FROM
      foo
    WHERE
      foo.a > 1
  `
  const result = execute(sql, { rules: { 'linebreak-after-clause-keyword': { level: 2} } })
  expect(result).toEqual([])
})

test('require linebreak after SELECT, FROM, WHERE keyword', () => {
  const sql = 'SELECT * FROM foo WHERE foo.a > 1'
  const result = execute(sql, { rules: { 'linebreak-after-clause-keyword': { level: 2} } })
  expect(result.length).toEqual(3)
})