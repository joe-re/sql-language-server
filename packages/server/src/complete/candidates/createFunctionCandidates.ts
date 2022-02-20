import { DbFunction } from '../../database_libs/AbstractClient'
import { toCompletionItemForFunction } from '../CompletionItemUtils'

export function createFunctionCandidates(
  functions: DbFunction[],
  token?: string
) {
  const lowerToken = token?.toLocaleLowerCase() ?? ''
  const isTypedUpper = token !== lowerToken
  const targets = functions.filter((v) => v.name.startsWith(lowerToken))
  return (
    targets
      // Search using lowercase prefix
      .filter((v) => v.name.startsWith(lowerToken))
      // If typed string is in upper case, then return upper case suggestions
      .map((v) => {
        if (isTypedUpper) v.name = v.name.toUpperCase()
        return v
      })
      .map((v) => toCompletionItemForFunction(v))
  )
}
