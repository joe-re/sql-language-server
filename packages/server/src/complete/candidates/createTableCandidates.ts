import { Table } from '../../database_libs/AbstractClient'
import { Identifier } from '../Identifier'
import { ICONS } from '../CompletionItemUtils'

/**
 * Given a table returns all possible ways to refer to it.
 * That is by table name only, using the database scope,
 * using the catalog and database scopes.
 * @param table
 * @returns
 */
function allTableNameCombinations(table: Table): string[] {
  const names = [table.tableName]
  if (table.database) names.push(table.database + '.' + table.tableName)
  if (table.catalog)
    names.push(table.catalog + '.' + table.database + '.' + table.tableName)
  return names
}

export function createTableCandidates(
  tables: Table[],
  lastToken: string,
  onFromClause?: boolean
) {
  return tables
    .flatMap((table) => allTableNameCombinations(table))
    .map((aTableNameVariant) => {
      return new Identifier(
        lastToken,
        aTableNameVariant,
        '',
        ICONS.TABLE,
        onFromClause ? 'FROM' : 'OTHERS'
      )
    })
    .filter((item) => item.matchesLastToken())
    .map((item) => item.toCompletionItem())
}
