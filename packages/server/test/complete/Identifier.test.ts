import { ICONS } from '../../src/complete/CompletionItemUtils'
import { Identifier } from '../../src/complete/index'

describe('Identifier', () => {
  describe('toCompletionItem', () => {
    test('complete comlumn name', () => {
      const item = new Identifier('col', 'column1', '', ICONS.COLUMN)
      const completion = item.toCompletionItem()
      expect(completion.label).toEqual('column1')
    })
    test('complete aliased comlumn name', () => {
      const item = new Identifier('ali.col', 'ali.column1', '', ICONS.COLUMN)
      const completion = item.toCompletionItem()
      expect(completion.label).toEqual('column1')
    })
    test('complete aliased nested comlumn last part name', () => {
      const item = new Identifier(
        'ali.column1.sub',
        'ali.column1.subcolumn2',
        '',
        ICONS.COLUMN
      )
      const completion = item.toCompletionItem()
      expect(completion.label).toEqual('subcolumn2')
    })
    test('complete aliased nested comlumn first part name', () => {
      const item = new Identifier(
        'ali.colu',
        'ali.column1.subcolumn2',
        '',
        ICONS.COLUMN
      )
      const completion = item.toCompletionItem()
      expect(completion.label).toEqual('column1.subcolumn2')
    })
  })
})
