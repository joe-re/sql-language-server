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

export type ExpectedNode =
  | ExpectedLiteralNode
  | ExpectedClassNode
  | ExpectedAnyNode
  | ExpectedEndNode
  | ExpectedOtherNode

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
  type: 'from'
  keyword: KeywordNode
  tables: FromTableNode[]
}

interface WhereClause extends BaseNode {
  type: 'where'
  keyword: KeywordNode
  expression: BinaryExpressionNode | ColumnRefNode
}

interface DeleteStatement extends BaseNode {
  type: 'delete'
  keyword: KeywordNode
  db: string
  table: TableNode
  where: WhereClause | null
}

interface DropTableStatement extends BaseNode {
  type: 'drop_table'
  keyword: KeywordNode
  table: TableNode
  if_exists: KeywordNode | null
}

interface InsertStatement extends BaseNode {
  type: 'insert'
  table: string
  columns: string[]
  values: ValuesClause
}

interface ValuesClause extends BaseNode {
  type: 'values'
  values: (SelectStatement | LiteralNode)[]
}

interface ColumnListItemNode extends BaseNode {
  type: 'column_list_item'
  expr: ColumnRefNode | AggrFuncNode
  as: string | null
}

interface ColumnRefNode extends BaseNode {
  type: 'column_ref'
  table: string
  column: string
}

interface AggrFuncNode extends BaseNode {
  type: 'aggr_func'
  name: string
  args: {
    expr: ColumnRefNode
  }
}

interface TableNode extends BaseNode {
  type: 'table'
  catalog: string | null
  db: string | null
  table: string
  as: string | null
  join?: 'INNER JOIN' | 'LEFT JOIN'
  on?: any
}

interface ColumnNode extends BaseNode {
  type: 'column'
  value: string
}

interface SubqueryNode extends BaseNode {
  type: 'subquery'
  as: 'string' | null
  subquery: SelectStatement
}

interface IncompleteSubqueryNode extends BaseNode {
  type: 'incomplete_subquery'
  as: 'string' | null
  text: string
}

interface CreateTableStatement extends BaseNode {
  type: 'create_table'
  keyword: KeywordNode
  if_not_exists: KeywordNode | null
  column_definitions: (ForeignKeyNode | FieldNode)[]
  select: SelectStatement | null
}

interface FieldNode extends BaseNode {
  type: 'field'
  name: string
  data_type: FieldDataTypeNode | null
  constraints: FieldConstraint[]
}

interface FieldDataTypeNode extends BaseNode {
  type: 'field_data_type'
  name: string
  args: string[]
}

interface AlterTableStatement extends BaseNode {
  type: 'alter_table'
  keyword: KeywordNode
  table: string
  command: AlterTableCommandNode
}

interface AlterTableCommandDropColumnNode extends BaseNode {
  type: 'alter_table_drop_column'
  keyword: KeywordNode
  column: ColumnNode
}

interface AlterTableCommandAddColumnNode extends BaseNode {
  type: 'alter_table_add_column'
  keyword: KeywordNode
  field: FieldNode
}

interface AlterTableCommandModifyColumnNode extends BaseNode {
  type: 'alter_table_modify_column'
  keyword: KeywordNode
  field: FieldNode
}

type AlterTableCommandNode =
  | AlterTableCommandDropColumnNode
  | AlterTableCommandAddColumnNode
  | AlterTableCommandModifyColumnNode

export interface FieldConstraintNotNull extends BaseNode {
  type: 'constraint_not_null'
  keyword: KeywordNode
}
export interface FieldConstraintPrimaryKey extends BaseNode {
  type: 'constraint_primary_key'
  keyword: KeywordNode
}
export interface FieldConstraintUnique extends BaseNode {
  type: 'constraint_unique'
  keyword: KeywordNode
}

export interface FieldConstraintDefault extends BaseNode {
  type: 'constraint_default'
  keyword: KeywordNode
  value: LiteralNode | FunctionNode | SpecialSystemFunctionNode
}

export type FieldConstraint =
  | FieldConstraintNotNull
  | FieldConstraintPrimaryKey
  | FieldConstraintUnique
  | FieldConstraintDefault

export interface VarDeclarationStandardNode extends BaseNode {
  type: 'var'
  name: string
  members: string[]
}

export interface VarDeclarationPgPromiseNode extends BaseNode {
  type: 'var_pg_promise'
  name: string
  members: string[]
}

export interface FunctionNode extends BaseNode {
  type: 'function'
  name: string
  args: {
    type  : 'expr_list'
    value : any[] // TODO: fix this
  }
}

export interface SpecialSystemFunctionNode extends BaseNode {
  type: 'special_system_function'
  name: string
}

export interface ForeignKeyNode extends BaseNode {
  type: 'foreign_key'
  foreign_keyword: KeywordNode
  columns: string[]
  references_keyword: KeywordNode
  references_table: string
  references_columns: string[]
  on: ForeignKeyOnNode | null
}

export interface ForeignKeyOnNode extends BaseNode {
  type: 'foreign_key_on'
  on_keyword: KeywordNode
  trigger: KeywordNode
  action: KeywordNode
}

export interface CreateIndexStatement extends BaseNode {
  type: 'create_index'
  create_keyword: KeywordNode
  index_keyword: KeywordNode
  if_not_exists_keyword: KeywordNode | null
  if_not_exists: boolean
  name: string
  on_keyword: KeywordNode
  table: string
  columns: string[]
}

export interface CreateTypeEnumStatement extends BaseNode {
  type: 'create_type'
  type_variant: 'enum_type'
  create_keyword: KeywordNode
  type_keyword: KeywordNode
  name: string
  as_keyword: KeywordNode
  enum_keyword: KeywordNode
  values: string[]
}

export interface CreateTypeCompositeFieldNode extends BaseNode {
  type: 'composite_type_field'
  name: string
  data_type: FieldDataTypeNode
}

export interface CreateTypeCompositeStatement extends BaseNode {
  type: 'create_type'
  type_variant: 'composite_type'
  create_keyword: KeywordNode
  type_keyword: KeywordNode
  name: string
  as_keyword: KeywordNode
  fields: CreateTypeCompositeFieldNode[]
}

export interface AssignValueExpressionNode extends BaseNode {
  type: 'assign_value_expr'
  name: string
  value: string | boolean | number
}
export interface CreateTypeRangeStatement extends BaseNode {
  type: 'create_type'
  type_variant: 'range_type'
  create_keyword: KeywordNode
  type_keyword: KeywordNode
  name: string
  as_keyword: KeywordNode
  range_keyword: KeywordNode
  values: AssignValueExpressionNode[]
}

export interface CreateTypeBaseStatement extends BaseNode {
  type: 'create_type'
  type_variant: 'base_type'
  create_keyword: KeywordNode
  type_keyword: KeywordNode
  name: string
  values: AssignValueExpressionNode[]
}

export type CreateTypeStatement =
  | CreateTypeEnumStatement
  | CreateTypeCompositeStatement
  | CreateTypeRangeStatement
  | CreateTypeBaseStatement

interface DropTypeStatement extends BaseNode {
  type: 'drop_type'
  drop_keyword: KeywordNode
  type_keyword: KeywordNode
  names: string[]
  if_exists: KeywordNode | null
  dependency_action: KeywordNode | null
}


type VarDeclarationNode = VarDeclarationStandardNode | VarDeclarationPgPromiseNode

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
  | ColumnNode
  | SubqueryNode
  | IncompleteSubqueryNode
  | CreateTableStatement
  | DropTableStatement
  | FieldNode
  | FieldDataTypeNode
  | FieldConstraint
  | AlterTableStatement
  | AlterTableCommandNode
  | VarDeclarationNode
  | FunctionNode
  | SpecialSystemFunctionNode
  | ForeignKeyNode
  | CreateIndexStatement
  | CreateTypeStatement
  | AssignValueExpressionNode
  | DropTypeStatement

export type StarNode = { type: 'star'; value: '*' }

export type FromTableNode = TableNode | SubqueryNode | IncompleteSubqueryNode

export type AST =
  | SelectStatement
  | DeleteStatement
  | DropTableStatement
  | InsertStatement
  | CreateTableStatement
  | AlterTableStatement
  | CreateIndexStatement
  | CreateTypeStatement
  | DropTypeStatement

export type LiteralNode =
  | LiteralStringNode
  | LiteralBoolNode
  | LiteralNumberNode
  | LiteralNullNode

export type ComparisonOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '>'
  | '>='
  | '<'
  | '<='
  | '!='
  | '<>'
  | '='

export type Operator = ComparisonOperator | 'OR' | 'AND' | 'NOT'

type FromClauseParserResult = {
  before: string
  from: FromClause | null
  after: string
}

export function parseFromClause(sql: string): FromClauseParserResult
export function parse(sql: string): AST
export function parseAll(sql: string): AST[]
