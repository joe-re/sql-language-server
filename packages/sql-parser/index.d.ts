export type NodePosition = {
  offset: number
  line: number
  column: number
}

export type NodeRange = {
  start: NodePosition
  end: NodePosition
}

export type BaseNode = {
  type: string
  location: NodeRange
}

export type KeywordNode = {
  type: 'keyword'
  value: string
  location: NodeRange
}

export type LiteralStringNode = {
  type: 'string'
  value: string
  location: NodeRange
}

export type LiteralBoolNode = {
  type: 'bool'
  value: boolean
  location: NodeRange
}

export type LiteralNumberNode = {
  type: 'number'
  value: number
  location: NodeRange
}

export type LiteralNullNode = {
  type: 'null'
  value: null
  location: NodeRange
}

export type LiteralNode =
  LiteralStringNode |
  LiteralBoolNode |
  LiteralNumberNode |
  LiteralNullNode

export type ComparisonOperator =
  '+' | '-' | '*' | '/' | '>' | '>=' | '<' | '<=' | '!=' | '<>' | '='

export type Operator =
   ComparisonOperator | 'OR' | 'AND' | 'NOT'

export type BinaryExpressionNode = {
  type: 'binary_expr'
  operator: Operator
  left: BaseNode | BinaryExpressionNode
  right: BaseNode | BinaryExpressionNode
  location: NodeRange 
}

export type AST = SelectStatement | DeleteStatement | InsertStatement | CreateTableStatement

export type SelectStatement = {
  type: 'select'
  keyword: KeywordNode
  distinct: 'distinct' | null
  columns: ColumnListItemNode[] | StarNode
  from: FromClause | null
  where: WhereClause | null
  groupBy: any
  orderBy: any
  location: NodeRange
}

export type FromClause = {
  type: 'from',
  keyword: KeywordNode,
  tables: FromTableNode[],
  location: NodeRange
}

export type WhereClause = {
  type: 'where',
  keyword: KeywordNode,
  expression: BinaryExpressionNode | ColumnRefNode,
  location: NodeRange
}

export type DeleteStatement = {
  type: 'delete'
  keyword: KeywordNode
  db: string
  table: TableNode
  where: WhereClause | null
  location: NodeRange
}

export type InsertStatement = {
  type: 'insert'
  table: string
  columns: string[]
  values: ValuesClause
  location: NodeRange
}

export type ValuesClause = {
  type: 'values',
  values: (SelectStatement | LiteralNode)[]
}

export type ColumnListItemNode = {
  type: 'column_list_item',
  expr: ColumnRefNode | AggrFuncNode,
  as: string | null,
  location: NodeRange
}

export type ColumnRefNode = {
  type: 'column_ref',
  table: string,
  column: string,
  location: NodeRange
}

export type AggrFuncNode = {
  type: 'aggr_func'
  name: string
  args: {
    expr: ColumnRefNode
  },
  location: NodeRange
}

export type StarNode = { type: 'star', value: '*' }

export type FromTableNode = TableNode | SubqueryNode | IncompleteSubqueryNode

export type TableNode = {
  type: 'table',
  catalog: string | null,
  db: string | null,
  table: string,
  as: string | null,
  location: NodeRange,
  join?: 'INNER JOIN' | 'LEFT JOIN',
  on?: any
}

export type SubqueryNode = {
  type: 'subquery',
  as: 'string' | null,
  subquery: SelectStatement,
  location: NodeRange
}

export type IncompleteSubqueryNode = {
  type: 'incomplete_subquery',
  as: 'string' | null,
  text: string,
  location: NodeRange
}

type FromClauseParserResult = {
  before: string,
  from: FromClause | null,
  after: string
}

export type CreateTableStatement = {
  type: 'create_table',
  keyword: KeywordNode,
  if_not_exist: KeywordNode | null,
  fields: FieldNode[],
  location: NodeRange
}

export type FieldNode = {
  type: 'field',
  name: string,
  data_type: FieldDataTypeNode | null,
  location: NodeRange
}

export type FieldDataTypeNode = {
  type: 'field_data_type',
  name: string,
  value: string | null,
  location: NodeRange
}

export function parseFromClause(sql: string): FromClauseParserResult
export function parse(sql: string): AST
