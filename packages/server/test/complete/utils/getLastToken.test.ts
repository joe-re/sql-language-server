import { getLastToken } from '../../../src/complete/utils/getLastToken'

describe('getLastToken', () => {
  test('getLastToken', () => {
    expect(getLastToken('SELECT  abc')).toEqual('abc')
    expect(getLastToken('SELECT  abc.def')).toEqual('abc.def')
    expect(getLastToken('SELECT  abc[0]')).toEqual('abc')
    expect(getLastToken('SELECT  abc[0].')).toEqual('abc.')
    expect(getLastToken('SELECT  abc[0].d')).toEqual('abc.d')
    expect(getLastToken('SELECT  abc[0].def[0]')).toEqual('abc.def')
    expect(getLastToken('SELECT  abc[0].def[0].')).toEqual('abc.def.')
    expect(getLastToken('SELECT  abc[0].def[0].g')).toEqual('abc.def.g')

    expect(getLastToken("SELECT  abc['key']")).toEqual('abc')
    expect(getLastToken("SELECT  abc['key.name'].")).toEqual('abc.')
    expect(getLastToken("SELECT  abc['key'].d")).toEqual('abc.d')
    expect(getLastToken("SELECT  abc['key'].def['key']")).toEqual('abc.def')
    expect(getLastToken("SELECT  abc['key'].def['key'].")).toEqual('abc.def.')
    expect(getLastToken("SELECT  abc['key'].def[0].g")).toEqual('abc.def.g')
    expect(getLastToken('SELECT  "abc"')).toEqual('abc')
  })
})
