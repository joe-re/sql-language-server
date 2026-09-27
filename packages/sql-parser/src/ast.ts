export type NodePosition = {
  /** 0-based offset */
  offset: number
  /** 1-based line */
  line: number
  /** 1-based column */
  column: number
}

/** `end` is exclusive */
export type NodeRange = {
  start: NodePosition
  end: NodePosition
}

export interface BaseNode {
  type: string
  location: NodeRange
}

export interface KeywordNode extends BaseNode {
  type: 'keyword'
  /** The keyword as written in the source (one or more words) */
  value: string
}

export interface LiteralStringNode extends BaseNode {
  type: 'string'
  value: string
}

export interface LiteralBoolNode extends BaseNode {
  type: 'bool'
  value: boolean
}

export interface LiteralNumberNode extends BaseNode {
  type: 'number'
  value: number
}

export interface LiteralNullNode extends BaseNode {
  type: 'null'
  value: null
}

export type LiteralNode =
  LiteralStringNode | LiteralBoolNode | LiteralNumberNode | LiteralNullNode

export type ComparisonOperator =
  '+' | '-' | '*' | '/' | '>' | '>=' | '<' | '<=' | '!=' | '<>' | '='

/** Keyword operators keep the casing of the source (e.g. `and`) */
export type Operator = ComparisonOperator | string

export interface BinaryExpressionNode extends BaseNode {
  type: 'binary_expr'
  operator: Operator
  left: ExpressionNode
  right: ExpressionNode
}

export interface UnaryExpressionNode extends BaseNode {
  type: 'unary_expr'
  operator: string
  expr: ExpressionNode
}

export interface ColumnRefNode extends BaseNode {
  type: 'column_ref'
  /** First part of a qualified reference (quotes removed), or '' */
  table: string
  column: string
}

export interface StarNode extends BaseNode {
  type: 'star'
  value: '*'
}

export interface ExprListNode extends BaseNode {
  type: 'expr_list'
  value: ExpressionNode[]
}

export interface AggrFuncNode extends BaseNode {
  type: 'aggr_func'
  name: string
  args: { expr: ExpressionNode | StarNode; distinct: KeywordNode | null }
}

export interface FunctionNode extends BaseNode {
  type: 'function'
  name: string
  args: ExprListNode
}

export interface SpecialSystemFunctionNode extends BaseNode {
  type: 'special_system_function'
  name: string
}

export interface CastFunctionNode extends BaseNode {
  type: 'cast_function'
  keyword: KeywordNode
  datatype: string
  expr: ExpressionNode
}

export interface CaseExpressionNode extends BaseNode {
  type: 'case'
  keyword: KeywordNode
  expr: ExpressionNode | null
  whens: { when: ExpressionNode; then: ExpressionNode }[]
  else: ExpressionNode | null
}

export interface VarDeclarationPgPromiseNode extends BaseNode {
  type: 'var_pg_promise'
  name: string
  members: string[]
}

export interface ParamNode extends BaseNode {
  type: 'param'
  value: string
}

export type ExpressionNode =
  | LiteralNode
  | ColumnRefNode
  | BinaryExpressionNode
  | UnaryExpressionNode
  | AggrFuncNode
  | FunctionNode
  | SpecialSystemFunctionNode
  | CastFunctionNode
  | CaseExpressionNode
  | VarDeclarationPgPromiseNode
  | ParamNode
  | ExprListNode
  | SelectStatement
  | StarNode

export interface WithClause extends BaseNode {
  type: 'with'
  keyword: KeywordNode
  recursive: KeywordNode | null
  cteList: CteNode[]
}

export interface CteNode extends BaseNode {
  type: 'cte'
  name: string
  arguments: string[]
  query: AST
}

export interface ColumnListItemNode extends BaseNode {
  type: 'column_list_item'
  expr: ExpressionNode
  as: string | null
}

export interface TableNode extends BaseNode {
  type: 'table'
  catalog: string
  db: string
  table: string
  as: string | null
  join?: string
  on?: ExpressionNode | null
}

export interface SubqueryNode extends BaseNode {
  type: 'subquery'
  subquery: SelectStatement
  as: string | null
  join?: string
  on?: ExpressionNode | null
}

/** A subquery in FROM that could not be parsed (e.g. while it is being typed) */
export interface IncompleteSubqueryNode extends BaseNode {
  type: 'incomplete_subquery'
  text: string
  as: string | null
  join?: string
  on?: ExpressionNode | null
}

export type FromTableNode = TableNode | SubqueryNode | IncompleteSubqueryNode

export interface FromClause extends BaseNode {
  type: 'from'
  keyword: KeywordNode
  tables: FromTableNode[]
}

export interface WhereClause extends BaseNode {
  type: 'where'
  keyword: KeywordNode
  expression: ExpressionNode
}

export interface OrderByItemNode extends BaseNode {
  type: 'order_by_item'
  expr: ExpressionNode
  order: KeywordNode | null
}

export interface LimitClause extends BaseNode {
  type: 'limit'
  keyword: KeywordNode
  value: ExpressionNode
  offset: ExpressionNode | null
}

export interface SelectStatement extends BaseNode {
  type: 'select'
  keyword: KeywordNode
  with: WithClause | null
  distinct: KeywordNode | null
  columns: ColumnListItemNode[] | StarNode
  from: FromClause | null
  where: WhereClause | null
  groupby: ExpressionNode[] | null
  orderby: OrderByItemNode[] | null
  limit: LimitClause | null
  /** Set when the statement was written in parentheses */
  paren?: true
  /** The next query of UNION / INTERSECT / EXCEPT */
  _next?: SelectStatement
  set_op?: KeywordNode
}

export interface InsertStatement extends BaseNode {
  type: 'insert'
  with: WithClause | null
  db: string
  table: string
  columns: string[]
  values: ValuesClause | null
  select?: SelectStatement
}

export interface ValuesClause extends BaseNode {
  type: 'values'
  /** Values of the first row */
  values: ExpressionNode[]
  /** Values of the second and later rows */
  more_rows?: ExpressionNode[][]
}

export interface SetItemNode {
  column: string
  value: ExpressionNode
}

export interface UpdateStatement extends BaseNode {
  type: 'update'
  with: WithClause | null
  db: string
  table: string
  join?: FromTableNode[]
  set: SetItemNode[]
  where: WhereClause | null
}

export interface DmlTableNode extends BaseNode {
  type: 'table'
  db: string
  table: string
}

export interface DeleteStatement extends BaseNode {
  type: 'delete'
  with: WithClause | null
  table: DmlTableNode
  where: WhereClause | null
}

export interface FieldDataTypeNode extends BaseNode {
  type: 'field_data_type'
  name: string
  args: string[]
}

export interface FieldConstraintNode extends BaseNode {
  type:
    | 'constraint_not_null'
    | 'constraint_unique'
    | 'constraint_primary_key'
    | 'constraint_auto_increment'
  keyword: KeywordNode
}

export interface FieldConstraintDefault extends BaseNode {
  type: 'constraint_default'
  keyword: KeywordNode
  value: ExpressionNode
}

export type FieldConstraint = FieldConstraintNode | FieldConstraintDefault

export interface FieldNode extends BaseNode {
  type: 'field'
  name: string
  data_type: FieldDataTypeNode | null
  constraints: FieldConstraint[]
}

export interface ForeignKeyOnNode extends BaseNode {
  type: 'foreign_key_on'
  on_keyword: KeywordNode
  trigger: KeywordNode
  action: KeywordNode
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

export interface PrimaryKeyNode extends BaseNode {
  type: 'primary_key'
  keyword: KeywordNode
  columns: string[]
}

export interface CreateTableStatement extends BaseNode {
  type: 'create_table'
  keyword: KeywordNode
  if_not_exists: KeywordNode | null
  column_definitions: (FieldNode | ForeignKeyNode | PrimaryKeyNode)[]
  select: SelectStatement | null
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

export interface AssignValueExpressionNode extends BaseNode {
  type: 'assign_value_expr'
  name: string
  value: string | number | boolean
}

export interface CreateTypeCompositeFieldNode extends BaseNode {
  type: 'composite_type_field'
  name: string
  data_type: FieldDataTypeNode
}

export interface CreateTypeStatement extends BaseNode {
  type: 'create_type'
  type_variant: 'composite_type' | 'enum_type' | 'range_type' | 'base_type'
  create_keyword: KeywordNode
  type_keyword: KeywordNode
  name: string
  as_keyword?: KeywordNode
  enum_keyword?: KeywordNode
  range_keyword?: KeywordNode
  fields?: CreateTypeCompositeFieldNode[]
  values?: (LiteralStringNode | AssignValueExpressionNode)[]
}

export interface ColumnNode extends BaseNode {
  type: 'column'
  value: string
}

export interface AlterTableCommandDropColumnNode extends BaseNode {
  type: 'alter_table_drop_column'
  keyword: KeywordNode
  column: ColumnNode
}

export interface AlterTableCommandAddColumnNode extends BaseNode {
  type: 'alter_table_add_column'
  keyword: KeywordNode
  field: FieldNode
}

export interface AlterTableCommandModifyColumnNode extends BaseNode {
  type: 'alter_table_modify_column'
  keyword: KeywordNode
  field: FieldNode
}

export type AlterTableCommandNode =
  | AlterTableCommandDropColumnNode
  | AlterTableCommandAddColumnNode
  | AlterTableCommandModifyColumnNode

export interface AlterTableStatement extends BaseNode {
  type: 'alter_table'
  keyword: KeywordNode
  table: string
  command: AlterTableCommandNode
}

export interface DropTableStatement extends BaseNode {
  type: 'drop_table'
  keyword: KeywordNode
  if_exists: KeywordNode | null
  table: DmlTableNode
}

export interface DropViewStatement extends BaseNode {
  type: 'drop_view'
  keyword: KeywordNode
  if_exists: KeywordNode | null
  views: ({ type: 'view'; value: string } & Pick<BaseNode, 'location'>)[]
  dependency_action: KeywordNode | null
}

export interface DropTypeStatement extends BaseNode {
  type: 'drop_type'
  drop_keyword: KeywordNode
  type_keyword: KeywordNode
  names: string[]
  if_exists: KeywordNode | null
  dependency_action: KeywordNode | null
}

export type AST =
  | SelectStatement
  | InsertStatement
  | UpdateStatement
  | DeleteStatement
  | CreateTableStatement
  | CreateIndexStatement
  | CreateTypeStatement
  | AlterTableStatement
  | DropTableStatement
  | DropViewStatement
  | DropTypeStatement

export type FromClauseParserResult = {
  before: string
  from: FromClause | null
  after: string
}
