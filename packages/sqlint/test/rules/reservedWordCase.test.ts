import { execute } from '../../src/rules'
import { applyFixes } from '../testUtil'

test('valid case', () => {
  const result = execute('SELECT * FROM foo', { rules: { 'reserved-word-case': { level: 2, option: 'upper' } } })
  expect(result).toEqual([])
})

describe('option: upper', () => {
  test('select keyword must be uppercase', () => {
    const sql = 'select * FROM foo'
    const result = execute(sql, { rules: { 'reserved-word-case': { level: 2, option: 'upper' } } })
    expect(result.length).toEqual(1)
    expect(result[0].message).toEqual('reserved word must be uppercase')
    expect(result[0].location.start).toEqual({line: 1, offset: 0,  column: 1 })
    expect(result[0].location.end).toEqual({ line: 1, offset: 6, column: 7 })
    expect(applyFixes(sql, [result[0].fix!].flat())).toEqual('SELECT * FROM foo')
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
})

describe('option: lower', () => {
  test('select keyword must be lowercase', () => {
    const sql = 'SELECT * from foo'
    const result = execute(sql, { rules: { 'reserved-word-case': { level: 2, option: 'lower' } } })
    expect(result.length).toEqual(1)
    expect(result[0].message).toEqual('reserved word must be lowercase')
    expect(result[0].location.start).toEqual({line: 1, offset: 0,  column: 1 })
    expect(result[0].location.end).toEqual({ line: 1, offset: 6, column: 7 })
    expect(applyFixes(sql, [result[0].fix!].flat())).toEqual('select * from foo')
  })
})

