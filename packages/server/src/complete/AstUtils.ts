import {
  ColumnRefNode,
  FromTableNode,
  SelectStatement,
  NodeRange,
} from '@joe-re/sql-parser'
import log4js from 'log4js'
import { Table } from '../database_libs/AbstractClient'

const logger = log4js.getLogger()

type Pos = { line: number; column: number }

function isNotEmpty<T>(value: T | null | undefined): value is T {
  return value === null || value === undefined ? false : true
}

export function getColumnRefByPos(
  columns: ColumnRefNode[],
  pos: Pos
): ColumnRefNode | null {
  return (
    columns.find(
      (v) =>
        // guard against ColumnRefNode that don't have a location,
        // for example sql functions that are not known to the parser
        v.location &&
        v.location.start.line === pos.line + 1 &&
        v.location.start.column <= pos.column &&
        v.location.end.line === pos.line + 1 &&
        v.location.end.column >= pos.column
    ) ?? null
  )
}

export function isPosInLocation(location: NodeRange, pos: Pos) {
  return (
    location.start.line === pos.line + 1 &&
    location.start.column <= pos.column &&
    location.end.line === pos.line + 1 &&
    location.end.column >= pos.column
  )
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

export function findColumnAtPosition(
  ast: SelectStatement,
  pos: Pos
): ColumnRefNode | null {
  const columns = ast.columns
  if (Array.isArray(columns)) {
    // columns in select clause
    const columnRefs = columns
      .map((col) => col.expr)
      .filter((expr): expr is ColumnRefNode => expr.type === 'column_ref')
    if (ast.type === 'select' && ast.where?.expression) {
      if (ast.where.expression.type === 'column_ref') {
        // columns in where clause
        columnRefs.push(ast.where.expression)
      }
    }
    // column at position
    const columnRef = getColumnRefByPos(columnRefs, pos)
    if (logger.isDebugEnabled()) logger.debug(JSON.stringify(columnRef))
    return columnRef ?? null
  } else if (columns.type == 'star') {
    if (ast.type === 'select' && ast.where?.expression) {
      // columns in where clause
      const columnRefs =
        ast.where.expression.type === 'column_ref' ? [ast.where.expression] : []
      // column at position
      const columnRef = getColumnRefByPos(columnRefs, pos)
      if (logger.isDebugEnabled()) logger.debug(JSON.stringify(columnRef))
      return columnRef ?? null
    }
  }
  return null
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
 * Finds the most deeply nested FROM node that have a range encompasing the position.
 * In cases such as SELECT * FROM T1 JOIN (SELECT * FROM (SELECT * FROM T2 <pos>))
 * We will get a list of nodes like this
 * SELECT * FROM T1
 * (SELECT * FROM
 *    (SELECT * FROM T2))
 * The idea is to reverse the list so that the most nested queries come first. Then
 * apply a filter to keep only the FROM nodes which encompass the position and take
 * the first one from that resulting list.
 * @param fromNodes
 * @param pos
 * @returns
 */
export function getNearestFromTableFromPos(
  fromNodes: FromTableNode[],
  pos: Pos
): FromTableNode | null {
  return (
    fromNodes
      .reverse()
      .filter((tableNode) => isPosInLocation(tableNode.location, pos))
      .shift() ?? null
  )
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
