import { applyFixes } from '../src/fixer'

describe('applyFixes', () => {
  it('should replace with new text', () => {
    const result = applyFixes('SELECT * FROM table WHERE a=1', [{
      range: { startOffset: 27, endOffset: 28 },
      text: ' ='
    }, {
      range: { startOffset: 29, endOffset: 30 },
      text: ' 1'
    }])
    expect(result).toEqual('SELECT * FROM table WHERE a = 1')
  })
})