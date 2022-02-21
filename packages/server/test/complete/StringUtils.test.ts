import * as StringUtils from '../../src/complete/StringUtils'
describe('StringUtils', () => {
  test('getLastToken', () => {
    expect(StringUtils.getLastToken('SELECT  abc')).toEqual('abc')
    expect(StringUtils.getLastToken('SELECT  abc.def')).toEqual('abc.def')
    expect(StringUtils.getLastToken('SELECT  abc[0]')).toEqual('abc')
    expect(StringUtils.getLastToken('SELECT  abc[0].')).toEqual('abc.')
    expect(StringUtils.getLastToken('SELECT  abc[0].d')).toEqual('abc.d')
    expect(StringUtils.getLastToken('SELECT  abc[0].def[0]')).toEqual('abc.def')
    expect(StringUtils.getLastToken('SELECT  abc[0].def[0].')).toEqual(
      'abc.def.'
    )
    expect(StringUtils.getLastToken('SELECT  abc[0].def[0].g')).toEqual(
      'abc.def.g'
    )

    expect(StringUtils.getLastToken("SELECT  abc['key']")).toEqual('abc')
    expect(StringUtils.getLastToken("SELECT  abc['key.name'].")).toEqual('abc.')
    expect(StringUtils.getLastToken("SELECT  abc['key'].d")).toEqual('abc.d')
    expect(StringUtils.getLastToken("SELECT  abc['key'].def['key']")).toEqual(
      'abc.def'
    )
    expect(StringUtils.getLastToken("SELECT  abc['key'].def['key'].")).toEqual(
      'abc.def.'
    )
    expect(StringUtils.getLastToken("SELECT  abc['key'].def[0].g")).toEqual(
      'abc.def.g'
    )
  })
})
