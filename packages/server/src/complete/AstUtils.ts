import { FromTableNode } from '@joe-re/sql-parser'
import { Table } from '../database_libs/AbstractClient'

function isNotEmpty<T>(value: T | null | undefined): value is T {
  return value === null || value === undefined ? false : true
}

export function createTablesFromFromNodes(fromNodes: FromTableNode[]): Table[] {
  return fromNodes.reduce((p, c) => {
    if (c.type !== 'subquery') {
      return p
    }
    if (!Array.isArray(c.subquery.columns)) {
      return p
    }
    const columns = c.subquery.columns
      .map((v) => {
        if (typeof v === 'string') {
          return null
        }
        return {
          columnName:
            v.as || (v.expr.type === 'column_ref' && v.expr.column) || '',
          description: 'alias',
        }
      })
      .filter(isNotEmpty)
    return p.concat({
      database: null,
      catalog: null,
      columns: columns ?? [],
      tableName: c.as ?? '',
    })
  }, [] as Table[])
}

/**
 * Recursively pull out the FROM nodes (including sub-queries)
 * @param tableNodes
 * @returns
 */
export function getAllNestedFromNodes(
  tableNodes: FromTableNode[]
): FromTableNode[] {
  return tableNodes.flatMap((tableNode) => {
    let result = [tableNode]
    if (tableNode.type == 'subquery') {
      const subTableNodes = tableNode.subquery.from?.tables || []
      result = result.concat(getAllNestedFromNodes(subTableNodes))
    }
    return result
  })
}

/**
 * Test if the given table matches the fromNode.
 * @param fromNode
 * @param table
 * @returns
 */
export function isTableMatch(fromNode: FromTableNode, table: Table): boolean {
  switch (fromNode.type) {
    case 'subquery': {
      if (fromNode.as && fromNode.as !== table.tableName) {
        return false
      }
      break
    }
    case 'table': {
      if (fromNode.table && fromNode.table !== table.tableName) {
        return false
      }
      if (fromNode.db && fromNode.db !== table.database) {
        return false
      }
      if (fromNode.catalog && fromNode.catalog !== table.catalog) {
        return false
      }
      break
    }
    default: {
      return false
    }
  }
  return true
}
