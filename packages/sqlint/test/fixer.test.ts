import { applyFixes, createFixer } from '../src/fixer'
import { createContext } from '../src/rules'

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

describe('fixer', () => {
  const message = 'message'
  const ctx = createContext('message', jest.fn(), jest.fn())
  const fixer = createFixer(ctx)

  describe('insertTextBefore', () => {
    it('should insert specified text before offset', () => {
      const result = fixer.insertTextBefore(1, 'insert')
      expect(result.text).toEqual('minsert')
      expect(result.range).toEqual({ startOffset: 0, endOffset: 1 })
      expect(applyFixes(message, [result])).toEqual('minsertessage')
    })
  })

  describe('replaceText', () => {
    it('should replace message with specified text at specified range', () => {
      const result = fixer.replaceText(1, 2, 'replace')
      expect(result.text).toEqual('replace')
      expect(result.range).toEqual({ startOffset: 1, endOffset: 2 })
      expect(applyFixes(message, [result])).toEqual('mreplacessage')
    })
  })
})
