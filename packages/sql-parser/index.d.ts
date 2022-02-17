export type NodePosition = {
  offset: number
  line: number
  column: number
}

export type NodeRange = {
  start: NodePosition
  end: NodePosition
}

// Syntax errors from PEG.js
export interface ExpectedLiteralNode {
  type: 'literal'
  text: string
  ignoreCase: boolean
}

export interface ExpectedClassNode {
  type: 'class'
  parts: any
  inverted: boolean
  ignoreCase: boolean
}

export interface ExpectedAnyNode {
  type: 'any'
}

export interface ExpectedEndNode {
  type: 'end'
}

export interface ExpectedOtherNode {
  type: 'other'
  description: string
}

// peg$SyntaxError {
//   message: 'EXPECTED COLUMN NAME',
//   expected: null,
//   found: null,
//   location: {
//     start: { offset: 18, line: 1, column: 19 },
//     end: { offset: 18, line: 1, column: 19 }
//   },
//   name: 'SyntaxError'
// }

export type ExpectedNode =
  ExpectedLiteralNode |
  ExpectedClassNode |
  ExpectedAnyNode |
  ExpectedEndNode |
  ExpectedOtherNode

interface BaseParseError extends Error {
  name: 'SyntaxError'
  message: string
  expected: ExpectedNode[] | null
  location: NodeRange
  found: any
}

interface ExpectedColumnNameParseError extends BaseParseError {
  message: 'EXPECTED COLUMN NAME'
  expected: null
  found: null
}

export type ParseError = BaseParseError | ExpectedColumnNameParseError

// Nodes defined on parser rules
interface BaseNode {
  type: string
  location: NodeRange
}

interface KeywordNode extends BaseNode {
  type: 'keyword'
  value: string
}

interface LiteralStringNode extends BaseNode {
  type: 'string'
  value: string
}

interface LiteralBoolNode extends BaseNode {
  type: 'bool'
  value: boolean
}

interface LiteralNumberNode extends BaseNode {
  type: 'number'
  value: number
}

interface LiteralNullNode extends BaseNode {
  type: 'null'
  value: null
}

interface BinaryExpressionNode extends BaseNode {
  type: 'binary_expr'
  operator: Operator
  left: BaseNode | BinaryExpressionNode
  right: BaseNode | BinaryExpressionNode
}

interface SelectStatement extends BaseNode {
  type: 'select'
  keyword: KeywordNode
  distinct: 'distinct' | null
  columns: ColumnListItemNode[] | StarNode
  from: FromClause | null
  where: WhereClause | null
  groupBy: any
  orderBy: any
}

interface FromClause extends BaseNode {
  type: 'from',
  keyword: KeywordNode,
  tables: FromTableNode[],
}

interface WhereClause extends BaseNode {
  type: 'where',
  keyword: KeywordNode,
  expression: BinaryExpressionNode | ColumnRefNode,
}

interface DeleteStatement extends BaseNode {
  type: 'delete'
  keyword: KeywordNode
  db: string
  table: TableNode
  where: WhereClause | null
}

interface InsertStatement extends BaseNode {
  type: 'insert'
  table: string
  columns: string[]
  values: ValuesClause
}

interface ValuesClause extends BaseNode {
  type: 'values',
  values: (SelectStatement | LiteralNode)[]
}

interface ColumnListItemNode extends BaseNode {
  type: 'column_list_item',
  expr: ColumnRefNode | AggrFuncNode,
  as: string | null,
}

interface ColumnRefNode extends BaseNode {
  type: 'column_ref',
  table: string,
  column: string,
}

interface AggrFuncNode extends BaseNode {
  type: 'aggr_func'
  name: string
  args: {
    expr: ColumnRefNode
  },
}

interface TableNode extends BaseNode {
  type: 'table',
  catalog: string | null,
  db: string | null,
  table: string,
  as: string | null,
  join?: 'INNER JOIN' | 'LEFT JOIN',
  on?: any
}

interface SubqueryNode extends BaseNode {
  type: 'subquery',
  as: 'string' | null,
  subquery: SelectStatement,
}

interface IncompleteSubqueryNode extends BaseNode {
  type: 'incomplete_subquery',
  as: 'string' | null,
  text: string,
}

interface CreateTableStatement extends BaseNode {
  type: 'create_table',
  keyword: KeywordNode,
  if_not_exists: KeywordNode | null,
  fields: FieldNode[],
  select: SelectStatement | null,
}

interface FieldNode extends BaseNode {
  type: 'field',
  name: string,
  data_type: FieldDataTypeNode | null,
  constraints: FieldConstraint[],
}

interface FieldDataTypeNode extends BaseNode {
  type: 'field_data_type',
  name: string,
  value: string | null,
}

type Node =
| KeywordNode
| LiteralStringNode
| LiteralBoolNode
| LiteralNumberNode
| LiteralNullNode
| BinaryExpressionNode
| SelectStatement
| FromClause
| WhereClause
| DeleteStatement
| InsertStatement
| ValuesClause
| ColumnListItemNode
| ColumnRefNode
| AggrFuncNode
| TableNode
| SubqueryNode
| IncompleteSubqueryNode
| CreateTableStatement
| FieldNode
| FieldDataTypeNode

export type StarNode = { type: 'star', value: '*' }

export type FieldConstraint =
  FieldConstraintNotNull |
  FieldConstraintPrimaryKey |
  FieldConstraintUnique

export type FieldConstraintNotNull = { type: 'constraint_not_null', keyword: KeywordNode }
export type FieldConstraintPrimaryKey = { type: 'constraint_primary_key', keyword: KeywordNode }
export type FieldConstraintUnique = { type: 'constraint_unique', keyword: KeywordNode }

export type FromTableNode = TableNode | SubqueryNode | IncompleteSubqueryNode

export type AST = SelectStatement | DeleteStatement | InsertStatement | CreateTableStatement
export type LiteralNode =
  LiteralStringNode |
  LiteralBoolNode |
  LiteralNumberNode |
  LiteralNullNode

export type ComparisonOperator =
  '+' | '-' | '*' | '/' | '>' | '>=' | '<' | '<=' | '!=' | '<>' | '='

export type Operator =
   ComparisonOperator | 'OR' | 'AND' | 'NOT'

type FromClauseParserResult = {
  before: string,
  from: FromClause | null,
  after: string
}

export function parseFromClause(sql: string): FromClauseParserResult
export function parse(sql: string): AST
