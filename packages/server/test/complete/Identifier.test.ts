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

    describe('ICONS.TABLE', () => {
      test('Add alias if it is onFromClause', () => {
        const item = new Identifier('T', 'TABLE1', '', ICONS.TABLE, 'FROM')
        const completion = item.toCompletionItem()
        expect(completion.label).toEqual('TABLE1')
        expect(completion.insertText).toEqual('TABLE1 AS TAB')
      })

      test("Doesn't add alias if it isn't onFromClause", () => {
        const item = new Identifier('T', 'TABLE1', '', ICONS.TABLE, 'OTHERS')
        const completion = item.toCompletionItem()
        expect(completion.label).toEqual('TABLE1')
        expect(completion.insertText).toEqual('TABLE1')
      })
    })
  })
})
