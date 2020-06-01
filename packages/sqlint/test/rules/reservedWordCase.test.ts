import { execute } from '../../src/rules'

test('valid case', () => {
  const result = execute('SELECT * FROM foo', { rules: { 'reserved-word-case': { level: 2, option: 'upper' } } })
  expect(result).toEqual([])
})

test('select keyword must be uppercase', () => {
  const result = execute('select * FROM foo', { rules: { 'reserved-word-case': { level: 2, option: 'upper' } } })
  expect(result.length).toEqual(1)
  expect(result[0].message).toEqual('reserved word must be uppercase')
  expect(result[0].location.start).toEqual({line: 1, offset: 0,  column: 1 })
  expect(result[0].location.end).toEqual({ line: 1, offset: 6, column: 7 })
})

test('select keyword must be lowercase', () => {
  const result = execute('SELECT * from foo', { rules: { 'reserved-word-case': { level: 2, option: 'lower' } } })
  expect(result.length).toEqual(1)
  expect(result[0].message).toEqual('reserved word must be lowercase')
  expect(result[0].location.start).toEqual({line: 1, offset: 0,  column: 1 })
  expect(result[0].location.end).toEqual({ line: 1, offset: 6, column: 7 })
})

test('from keyword must be uppercase', () => {
  const result = execute('SELECT * from foo', { rules: { 'reserved-word-case': { level: 2, option: 'upper' } } })
  expect(result.length).toEqual(1)
  expect(result[0].message).toEqual('reserved word must be uppercase')
  expect(result[0].location.start).toEqual({line: 1, offset: 9,  column: 10 })
  expect(result[0].location.end).toEqual({ line: 1, offset: 13, column: 14 })
})

test('where keyword must be uppercase', () => {
  const result = execute('SELECT * FROM foo where id = 1', { rules: { 'reserved-word-case': { level: 2, option: 'upper' } } })
  expect(result.length).toEqual(1)
  expect(result[0].message).toEqual('reserved word must be uppercase')
  expect(result[0].location.start).toEqual({line: 1, offset: 18,  column: 19 })
  expect(result[0].location.end).toEqual({ line: 1, offset: 23, column: 24 })
})