{
  var reservedMap = module.exports.reservedMap || {};

  function debug(str){
    console.log(str);
  }

  function createUnaryExpr(op, e) {
    return {
      type     : 'unary_expr',
      operator : op,
      expr     : e
    }
  }

  function createBinaryExpr(op, left, right) {
    return {
      type      : 'binary_expr',
      operator  : op,
      left      : left,
      right     : right,
      location  : location()
    }
  }

  function createList(head, tail, idx=3) {
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i][idx]);
    }
    return result;
  }

  function createExprList(head, tail, room) {
    var epList = createList(head, tail);
    var exprList  = [];
    var ep;
    for (var i = 0; i < epList.length; i++) {
      ep = epList[i];
      if (ep && ep.type == 'param') {
        ep.room = room;
        ep.pos  = i;
      } else {
        exprList.push(ep);
      }
    }
    return exprList;
  }

  function createBinaryExprChain(head, tail) {
    var result = head;
    for (var i = 0; i < tail.length; i++) {
      result = createBinaryExpr(tail[i][1], result, tail[i][3]);
    }
    return result;
  }

  function makeKeywordNode(val, location) {
    return {
      type: 'keyword',
      value: val,
      location: location
    }
  }
}

start
  = &{ return true; } __ ast:ast __ tail: ((EOSQL __ start / EOSQL))* {
      return {
        ast   : ast,
        asts  : [ast].concat(tail.map(v => v[2].ast))
      }
    }
    /ast:proc_stmts {
      return {
        ast : ast
      }
    }

ast =
  union_stmt /
  update_stmt /
  replace_insert_stmt /
  delete_stmt /
  drop_table_stmt /
  create_table_stmt /
  alter_table_stmt /
  create_index_stmt /
  drop_index_stmt /
  create_type_stmt /
  drop_type_stmt

union_stmt
  = head:select_stmt tail:(__ KW_UNION __ KW_ALL? __ select_stmt)* {
      var cur = head;
      for (var i = 0; i < tail.length; i++) {
        cur._next = tail[i][3];
        cur = cur._next
      }
      return head;
    }

select_stmt
  =  select_stmt_nake
  / s:('(' __ select_stmt __ ')') {
      return s[2];
    }

extract_from_clause
  = before:(__ LPAREN? __ KW_SELECT __ (!(KW_FROM) .)* { return text() }) __
    f:from_clause? __
    after:(.*) {
      return {
        before: before,
        from: f,
        after: after.join('')
      }
    }

with_clause
  = keyword: KW_WITH __ recursive: KW_RECURSIVE? __ cteList: CTE_list {
    return {
      type: "with",
      keyword: keyword,
      recursive: recursive,
      cteList: cteList,
    }
  }

CTE_list
  = first: CTE_definition __ "," __ rest: CTE_list {
    return [first].concat(rest)
  }
  / cte:CTE_definition {
    return [cte]
  }

CTE_definition
  = name:ident __ args:arguments? __ "AS" __ "(" __ query:union_stmt __ ")" {
      return {
        type: "cte",
        name: name,
        arguments: args || [],
        query: query
      };
    }

arguments
  = "(" __ args:ident_list __ ")" {
      return args;
    }

ident_list
  = first:ident __ "," __ rest:ident_list {
      return [first].concat(rest);
    }
  / identifier:ident {
      return [identifier];
    }

select_stmt_nake
  = with_clause:with_clause?  __
    val:select_keyword  __
    d:KW_DISTINCT?      __
    c:column_clause     __
    f:from_clause?      __
    w:where_clause?     __
    g:group_by_clause?  __
    o:order_by_clause?  __
    l:limit_clause?  {
      return {
        type      : 'select',
        keyword   : val,
        with      : with_clause,
        distinct  : d,
        columns   : c,
        from      : f,
        where     : w,
        groupby   : g,
        orderby   : o,
        limit     : l,
        location  : location()
      }
  }

select_keyword
  = val: KW_SELECT {
    return { type: 'keyword', value: val && val[0], location: location() }
  }

column_clause
  = (KW_ALL / (STAR !ident_start)) {
      return { type: 'star', value: '*' };
    }
  / head:column_list_item tail:(__ COMMA __ column_list_item)* {
      return createList(head, tail);
    }

/**
 * maybe you should use `expr` instead of `primary` or `additive_expr`
 * to support complicated expression in column clause
 */
column_list_item
  = e:additive_expr __ alias:alias_clause? {
      return {
        type: 'column_list_item',
        expr : e,
        as : alias,
        location: location()
      };
    }

alias_clause
  = KW_AS? __ i:ident { return i; }

from_clause
  = k:from_keyword __
    l:table_ref_list {
      return {
        type: 'from',
        keyword: k,
        tables: l,
        location: location()
      }
  }

from_keyword
  = val: KW_FROM {
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }

table_ref_list
  = head:table_base
    tail:table_ref*  {
      tail.unshift(head);
      return tail;
    }

table_ref
  = __ COMMA __ t:table_base { return t; }
  / __ t:table_join { return t; }


table_join
  = op:join_op __ t:table_base __ expr:on_clause? {
    t.join = op;
    t.on   = expr;
    return t;
    /*
      return  {
        db    : t.db,
        table : t.table,
        as    : t.as,
        join  : op,
        on    : expr
      }
    */
    }

//NOTE that ,the table assigned to `var` shouldn't write in `table_join`
table_base
  = cat:catalog_name __ DOT __ db:db_name __ DOT __ t:table_name __ KW_AS? __ alias:ident? {
      if (t && t.type == 'var') {
        t.as = alias;
        return t;
      } else {
        return  {
          type: 'table',
          catalog: cat,
          db    : db,
          table : t,
          as    : alias,
          location: location()
        }
      }
    }
  / db:db_name __ DOT __ t:table_name __ KW_AS? __ alias:ident? {
      if (t && t.type == 'var') {
        t.as = alias;
        return t;
      } else {
        return  {
          type: 'table',
          catalog: '',
          db    : db,
          table : t,
          as    : alias,
          location: location()
        }
      }
    }
  / t:table_name __ KW_AS? __ alias:ident? {
      if (t && t.type == 'var') {
        t.as = alias;
        return t;
      } else {
        return  {
          type: 'table',
          catalog: '',
          db    : '',
          table : t,
          as    : alias,
          location: location()
        }
      }
    }
  / s:select_stmt __ KW_AS? __ alias:ident? {
      return  { type: 'subquery', subquery: s, as: alias, location: location() };
    }
  / LPAREN __ table:table_base __ RPAREN __ KW_AS? __ alias:ident? {
      return  { type: 'subquery', subquery: table, as: alias, location: location() };
    }
  / text:(LPAREN __ ([^)]* {return text()}) __ RPAREN) __ KW_AS? __ alias:ident? {
      return  { type: 'incomplete_subquery', text: text.join(''), as: alias, location: location() };
    }

join_op
  = KW_LEFT __ KW_JOIN { return 'LEFT JOIN'; }
  / (KW_INNER __)? KW_JOIN { return 'INNER JOIN'; }

catalog_name
  = cat: ident_name {
    return cat;
  }

db_name
  = db:ident_name {
    return db;
  }

table_name
  = table:ident {
      return table;
    }
    /v:var_decl {
      return v.name;
    }

on_clause
  = KW_ON __ e:expr { return e; }

where_clause
  = k: where_keyword __
    e:expr {
      return {
        type: 'where',
        keyword: k,
        expression: e,
        location: location()
      }
    }

where_keyword
  = val: KW_WHERE {
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }


group_by_clause
  = KW_GROUP __ KW_BY __ l:column_ref_list { return l; }

column_ref_list
  = head:column_ref tail:(__ COMMA __ column_ref)* {
      return createList(head, tail);
    }

having_clause
  = KW_HAVING e:expr { return e; }

order_by_clause
  = KW_ORDER __ KW_BY __ l:order_by_list { return l; }

order_by_list
  = head:order_by_element tail:(__ COMMA __ order_by_element)* {
      return createList(head, tail);
    }

order_by_element
  = e:expr __ d:(KW_DESC / KW_ASC)? {
    var obj = {
      expr : e,
      type : 'ASC'
    }
    if (d == 'DESC') {
      obj.type = 'DESC';
    }
    return obj;
  }

number_or_param
  = literal_numeric
  / param

limit_clause
  = KW_LIMIT __ i1:(number_or_param) __ tail:(COMMA __ number_or_param)? {
      var res = [i1];
      if (tail === null) {
        res.unshift({
          type  : 'number',
          value : 0
        });
      } else {
        res.push(tail[2]);
      }
      return res;
    }

update_stmt
  = with_clause: with_clause? __
    KW_UPDATE    __
    db:db_name   __ DOT __
    t:table_name __
    KW_SET       __
    l:set_list   __
    w:where_clause? {
      return {
        type  : 'update',
        with: with_clause,
        db    : db,
        table : t,
        set   : l,
        where : w
      }
    }
  / with_clause: with_clause? __
    KW_UPDATE    __
    t:table_name __
    KW_SET       __
    l:set_list   __
    w:where_clause? {
      return {
        type  : 'update',
        with: with_clause,
        db    : '',
        table : t,
        set   : l,
        where : w
      }
    }
  / with_clause: with_clause? __
    KW_UPDATE    __
    t:table_name __
    j:table_ref* __
    KW_SET       __
    l:set_list   __
    w:where_clause? {
      return {
        type  : 'update',
        with: with_clause,
        db    : '',
        table : t,
        join  : j,
        set   : l,
        where : w
      }
    }

set_list
  = head:set_item tail:(__ COMMA __ set_item)*  {
      return createList(head, tail);
    }

set_item
  = c:column __ '=' __ v:additive_expr {
      return {
        column: c,
        value : v
      }
    }
  / t:ident __ DOT __ c:column __ '=' __ v:additive_expr {
      return {
        table: t,
        column: c,
        value : v
      }
    }
  / !{error('EXPECTED COLUMN NAME')}

replace_insert_stmt
  = with_clause: with_clause? __
    ri:replace_insert        __
    KW_INTO                  __
    db:db_name    __  DOT    __
    t:table_name  __
    c:insert_column_list __
    v:value_clause             {
      return {
        type      : ri,
        with: with_clause,
        db        : db,
        table     : t,
        columns   : c,
        values    : v
      }
    }
  / with_clause: with_clause? __
    ri:replace_insert       __
    KW_INTO                 __
    db:db_name       __ DOT __
    t:table_name            __
    KW_SET                  __
    l:set_list              __
    u:on_duplicate_key_update? {
      var v = {
        type  : ri,
        with: with_clause,
        db    : db,
        table : t,
        set   : l
      };

      if (u) {
        v.duplicateSet = u;
      }

      return v;
    }
  / with_clause: with_clause? __
    ri:replace_insert       __
    KW_INTO                 __
    t:table_name  __
    c:insert_column_list __
    v:value_clause             {
      return {
        type      : ri,
        with: with_clause,
        db        : '',
        table     : t,
        columns   : c,
        values    : v
      }
    }
  / with_clause: with_clause? __
    ri:replace_insert       __
    KW_INTO                 __
    t:table_name            __
    KW_SET                  __
    l:set_list              __
    u:on_duplicate_key_update? {
      var v = {
        type  : ri,
        with: with_clause,
        db    : '',
        table : t,
        set   : l
      }

      if (u) {
        v.duplicateSet = u;
      }

      return v;
    }

insert_column_list =
  LPAREN __ (c:column_list __ (RPAREN / !{error('EXPECTED COLUMN NAME')}) {
    return c
  })


replace_insert
  = KW_INSERT   { return 'insert'; }
  / KW_REPLACE  { return 'replace' }

value_clause
  = KW_VALUES __ l:values  {
    return {
      type: 'values',
      values: l
    };
  }

on_duplicate_key_update
  = KW_ON __ KW_DUPLICATE __ KW_KEY __ KW_UPDATE __ l:set_list {
    return l;
  }

values
  = LPAREN __
    head:(expr / select_stmt) tail:(__ COMMA __ (expr / select_stmt))* __
    RPAREN {
    var l = createExprList(head, tail);
    return l;
  }

expr_list
  = head:expr tail:(__ COMMA __ expr)*{
      var el = {
        type : 'expr_list'
      }
      var l = createExprList(head, tail, el);

      el.value = l;
      return el;
    }

expr_list_or_empty
  = l:expr_list
  / "" {
      return {
        type  : 'expr_list',
        value : []
      }
    }

expr = or_expr

or_expr
  = head:and_expr tail:(__ KW_OR __ and_expr)* {
      return createBinaryExprChain(head, tail);
    }

and_expr
  = head:not_expr tail:(__ KW_AND __ not_expr)* {
      return createBinaryExprChain(head, tail);
    }

// here we should use `NOT` instead of `comparision_expr` to support chain-expr
not_expr
  = (KW_NOT / "!" !"=") __ expr:not_expr {
      return createUnaryExpr('NOT', expr);
    }
  / comparison_expr

comparison_expr
  = left:additive_expr __ rh:comparison_op_right? {
      if (rh === null) {
        return left;
      } else {
        var res = null;
        if (rh !== null && rh.type == 'arithmetic') {
          res = createBinaryExprChain(left, rh.tail);
        } else {
          res = createBinaryExpr(rh && rh.op, left, rh && rh.right);
        }
        return res;
      }
    }

comparison_op_right
  = arithmetic_op_right
    / in_op_right
    / between_op_right
    / is_op_right
    / like_op_right
    / contains_op_right

arithmetic_op_right
  = l:(__ arithmetic_comparison_operator __ additive_expr)+ {
      return {
        type : 'arithmetic',
        tail : l
      }
    }

arithmetic_comparison_operator
  = ">=" / ">" / "<=" / "<>" / "<" / "=" / "!="

between_op_right
  = op:KW_BETWEEN __  begin:additive_expr __ KW_AND __ end:additive_expr {
    return {
      op: op,
      right: {
        type: 'expr_list',
        value: [begin, end]
      }
    }
  }

is_op_right
  = op:KW_IS __ not:KW_NOT? __ right:KW_NULL {
    return {
      op    : op,
      right : ((not || '') + ' ' + right[0]).trim()
    }
  }
  / op:KW_IS __ right:additive_expr {
    return {
      op    : op,
      right : right
    }
  }


like_op
  = nk:(KW_NOT __ KW_LIKE) { return nk[0] + ' ' + nk[2]; }
  / KW_LIKE

in_op
  = nk:(KW_NOT __ KW_IN) { return nk[0] + ' ' + nk[2]; }
  / KW_IN

contains_op
  = nk:(KW_NOT __ KW_CONTAINS) { return nk[0] + ' ' + nk[2]; }
  / KW_CONTAINS

like_op_right
  = op:like_op __ right:comparison_expr {
      return {
        op    : op,
        right : right
      }
    }

in_op_right
  = op:in_op __ LPAREN  __ l:expr_list __ RPAREN {
      return {
        op    : op,
        right : l
      }
    }
  / op:in_op __ l:select_stmt {
    return {
        op    : op,
        right : l
      }
    }
  / op:in_op __ e:var_decl {
      return {
        op    : op,
        right : e
      }
    }

contains_op_right
  = op:contains_op __ LPAREN  __ l:expr_list __ RPAREN {
      return {
        op    : op,
        right : l
      }
    }
  / op:contains_op __ e:var_decl {
      return {
        op    : op,
        right : e
      }
    }

additive_expr
  = head:multiplicative_expr
    tail:(__ additive_operator  __ multiplicative_expr)* {
      return createBinaryExprChain(head, tail);
    }

additive_operator
  = "+" / "-"

multiplicative_expr
  = head:primary
    tail:(__ multiplicative_operator  __ primary)* {
      return createBinaryExprChain(head, tail)
    }

multiplicative_operator
  = "*" / "/" / "%"

primary
  = literal
  / aggr_func
  / func_call
  / column_ref
  / param
  / LPAREN __ e:expr __ RPAREN {
      e.paren = true;
      return e;
    }
  / select_stmt
  / var_decl

column_ref
  = tbl:ident __ DOT __ col:column {
      return {
        type  : 'column_ref',
        table : tbl,
        column : col,
        location: location()
      };
    }
  / col:column {
      return {
        type  : 'column_ref',
        table : '',
        column: col,
        location: location()
      };
    }

column_list
  = head:column tail:(__ COMMA __ column)* {
      return createList(head, tail);
    }

ident =
  name:ident_name !{ return reservedMap[name.toUpperCase()] === true; } {
    return name;
  }
  / '`' chars:[^`]+ '`' {
    return chars.join('');
  }
  / DQUOTE chars:[^"]+ DQUOTE {
    return chars.join('');
  }

column =
  name:column_name !{ return reservedMap[name.toUpperCase()] === true; } {
    return name;
  }
  / backtik_column ([.] backtik_column)* {
    return text();
  }
  / DQUOTE name:column_name DQUOTE {
    return name;
  }

// This is for syntax that COLUMN should not have table.
// eg. alter table table_name add COLUMN_NAME column_definition;
column_node
  = col:column {
    return {
      type: 'column',
      value: col,
      location: location()
    };
  }

backtik_column = '`' chars:[^`]+ '`'

// Supports nested column names like `books.chapters.paragraphs`
column_name
  = ident_start column_char* ([.] column_char+)* {
     return text();
  }

ident_name
  =  start:ident_start parts:ident_part* { return start + parts.join(''); }

ident_start = [A-Za-z_]

ident_part  = [A-Za-z0-9_]

// to support column name like `cf1:name` in hbase
// Allow square brackets and quote to support nested columns with subscripts for example `books['title'].chapters[12].paragraphs`
column_char  = [A-Za-z0-9_:\[\]\']

param
  = l:([:@] ident_name) {
    var p = {
      type : 'param',
      value: l[1]
    }
    return p;
  }

aggr_func
  = aggr_fun_count
  / aggr_fun_smma

aggr_fun_smma
  = name:KW_SUM_MAX_MIN_AVG  __ LPAREN __ e:additive_expr __ RPAREN {
      return {
        type : 'aggr_func',
        name : name,
        args : {
          expr : e
        },
        location: location()
      }
    }

KW_SUM_MAX_MIN_AVG
  = KW_SUM / KW_MAX / KW_MIN / KW_AVG

aggr_fun_count
  = name:KW_COUNT __ LPAREN __ arg:count_arg __ RPAREN {
      return {
        type : 'aggr_func',
        name : name,
        args : arg,
        location: location()
      }
    }

count_arg
  = e:star_expr {
      return {
        expr  : e
      }
    }
  / d:KW_DISTINCT? __ c:column_ref {
      return {
        distinct : d,
        expr   : c
      }
    }

star_expr
  = "*" {
      return {
        type  : 'star',
        value : '*'
      }
    }

func_call = func_call_cast / func_call_others

func_call_others
  = name:ident __ LPAREN __ l:expr_list_or_empty __ RPAREN {
      return {
        type : 'function',
        name : name,
        args : l
      }
    }

func_call_cast
  = keyword:KW_CAST __ LPAREN __ e:expr __ KW_AS __ datatype:ident __ RPAREN {
    return {
      type: 'cast_function',
      keyword: keyword,
      datatype: datatype,
      expr: e
    }
  }

literal
  = l:(literal_string / literal_numeric / literal_bool / literal_null)!DOT {
    return l
  }

literal_list
  = head:literal tail:(__ COMMA __ literal)* {
      return createList(head, tail);
    }

literal_null
  = KW_NULL {
      return {
        type     : 'null',
        value    : null,
        location : location()
      };
    }

literal_bool
  = KW_TRUE {
      return {
        type     : 'bool',
        value    : true,
        location : location()
      };
    }
  / KW_FALSE {
      return {
        type     : 'bool',
        value    : false,
        location : location()
      };
    }

literal_string
  = ca:( ('"' double_char* '"')
        /("'" single_char* "'")) {
      return {
        type     : 'string',
        value    : ca[1].join(''),
        location : location()
      }
    }

single_char
  = [^'\\\0-\x1F\x7f]
  / escape_char

double_char
  = [^"\\\0-\x1F\x7f]
  / escape_char

escape_char
  = "\\'"  { return "'";  }
  / '\\"'  { return '"';  }
  / "\\\\" { return "\\"; }
  / "\\/"  { return "/";  }
  / "\\b"  { return "\b"; }
  / "\\f"  { return "\f"; }
  / "\\n"  { return "\n"; }
  / "\\r"  { return "\r"; }
  / "\\t"  { return "\t"; }
  / "\\u" h1:hexDigit h2:hexDigit h3:hexDigit h4:hexDigit {
      return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
    }

line_terminator
  = [\n\r]

literal_numeric
  = n:number {
      return {
        type    : 'number',
        value   : n,
        location: location()
      }
    }

number
  = int_:int frac:frac exp:exp __ { return parseFloat(int_ + frac + exp); }
  / int_:int frac:frac __         { return parseFloat(int_ + frac);       }
  / int_:int exp:exp __           { return parseFloat(int_ + exp);        }
  / int_:int __                   { return parseFloat(int_);              }

int
  = digit19:digit19 digits:digits     { return digit19 + digits;       }
  / digit:digit
  / op:("-" / "+" ) digit19:digit19 digits:digits { return "-" + digit19 + digits; }
  / op:("-" / "+" ) digit:digit                   { return "-" + digit;            }

frac
  = "." digits:digits { return "." + digits; }

exp
  = e:e digits:digits { return e + digits; }

digits
  = digits:digit+ { return digits.join(""); }

digit   = [0-9]
digit19 = [1-9]

hexDigit
  = [0-9a-fA-F]

e
  = e:[eE] sign:[+-]? { return e + (sign || ''); }

KW_NULL               = "NULL"i               !ident_start
KW_NOT_NULL           = "NOT NULL"i           !ident_start
KW_UNIQUE             = "UNIQUE"i             !ident_start
KW_PRIMARY_KEY        = "PRIMARY KEY"i        !ident_start
KW_INCREMENT          = "INCREMENT"i          !ident_start
KW_AUTO_INCREMENT     = "AUTO_INCREMENT"i     !ident_start
KW_DEFAULT            = val:"DEFAULT"i        !ident_start { return makeKeywordNode(val, location()) }
KW_GENERATED          = "GENERATED"i          !ident_start
KW_ALWAYS             = "ALWAYS"i             !ident_start
KW_BY_DEFAULT         = "BY DEFAULT"i         !ident_start
KW_BY_DEFAULT_ON_NULL = "BY DEFAULT ON NULL"i !ident_start
KW_IDENTITY           = "IDENTITY"i           !ident_start
KW_START              = "START"i              !ident_start
KW_WITH               = val:"WITH"i           !ident_start { return makeKeywordNode(val, location()) }
KW_MINVALUE           = "MINVALUE"i           !ident_start
KW_NO_MINVALUE        = "NO MINVALUE"i        !ident_start
KW_MAXVALUE           = "MAXVALUE"i           !ident_start
KW_NO_MAXVALUE        = "NO MAXVALUE"i        !ident_start
KW_OWNED_BY           = "OWNED BY"i           !ident_start
KW_OWNED_BY_NONE      = "OWNED BY NONE"i      !ident_start
KW_CACHE              = "CACHE"i              !ident_start
KW_CYCLE              = "CYCLE"i              !ident_start
KW_NO_CYCLE           = "NO CYCLE"i           !ident_start
KW_CHECK              = "CHECK"i              !ident_start
KW_TRUE               = "TRUE"i               !ident_start
KW_FALSE              = "FALSE"i              !ident_start

KW_SHOW           = "SHOW"i             !ident_start
KW_DROP           = val:"DROP"i         !ident_start { return makeKeywordNode(val, location()) }
KW_SELECT         = "SELECT"i           !ident_start
KW_UPDATE         = val:"UPDATE"i       !ident_start { return makeKeywordNode(val, location()) }
KW_CREATE         = val:"CREATE"i       !ident_start { return makeKeywordNode(val, location()) }
KW_CREATE_TABLE   = "CREATE TABLE"i     !ident_start
KW_DROP_TABLE     = "DROP TABLE"i       !ident_start
KW_IF_NOT_EXISTS  = "IF NOT EXISTS"i    !ident_start
KW_IF_EXISTS      = val:"IF EXISTS"i    !ident_start { return makeKeywordNode(val, location()) }
KW_CONCURRENTLY   = val:"CONCURRENTLY"i !ident_start { return makeKeywordNode(val, location()) }
KW_DELETE         = val:"DELETE"i       !ident_start { return makeKeywordNode(val, location()) }
KW_INSERT         = "INSERT"i           !ident_start
KW_REPLACE        = "REPLACE"i          !ident_start
KW_EXPLAIN        = "EXPLAIN"i          !ident_start
KW_ALTER          = "ALTER"i            !ident_start

KW_ADD            = "ADD"i            !ident_start
KW_MODIFY         = "MODIFY"i         !ident_start
KW_DROP_COLUMN    = "DROP COLUMN"i    !ident_start
KW_INTO           = "INTO"i           !ident_start
KW_FROM           = "FROM"i           !ident_start
KW_SET            = "SET"i            !ident_start

KW_AS             = "AS"i             !ident_start
KW_TABLE          = "TABLE"i          !ident_start
KW_COLUMN         = "COLUMN"i         !ident_start

KW_ON             = val:"ON"i         !ident_start { return makeKeywordNode(val, location()) }
KW_LEFT           = "LEFT"i           !ident_start
KW_INNER          = "INNER"i          !ident_start
KW_JOIN           = "JOIN"i           !ident_start
KW_UNION          = "UNION"i          !ident_start
KW_VALUES         = "VALUES"i         !ident_start

KW_EXISTS         = "EXISTS"i         !ident_start

KW_WHERE          = "WHERE"i          !ident_start

KW_GROUP          = "GROUP"i          !ident_start
KW_BY             = "BY"i             !ident_start
KW_ORDER          = "ORDER"i          !ident_start
KW_HAVING         = "HAVING"i         !ident_start

KW_LIMIT          = "LIMIT"i          !ident_start

KW_ASC            = "ASC"i            !ident_start    { return 'ASC';      }
KW_DESC           = "DESC"i           !ident_start    { return 'DESC';     }

KW_ALL            = "ALL"i            !ident_start    { return 'ALL';      }
KW_DISTINCT       = "DISTINCT"i       !ident_start    { return 'DISTINCT'; }
KW_DUPLICATE      = "DUPLICATE"i      !ident_start    { return 'DUPLICATE';}
KW_BETWEEN        = "BETWEEN"i        !ident_start    { return 'BETWEEN';  }
KW_IN             = "IN"i             !ident_start    { return 'IN';       }
KW_IS             = "IS"i             !ident_start    { return 'IS';       }
KW_LIKE           = "LIKE"i           !ident_start    { return 'LIKE';     }
KW_CONTAINS       = "CONTAINS"i       !ident_start    { return 'CONTAINS'; }
KW_KEY            = "KEY"i            !ident_start    { return 'KEY';      }

KW_NOT            = "NOT"i            !ident_start    { return 'NOT';      }
KW_AND            = "AND"i            !ident_start    { return 'AND';      }
KW_OR             = "OR"i             !ident_start    { return 'OR';       }

KW_COUNT          = "COUNT"i          !ident_start    { return 'COUNT';    }
KW_MAX            = "MAX"i            !ident_start    { return 'MAX';      }
KW_MIN            = "MIN"i            !ident_start    { return 'MIN';      }
KW_SUM            = "SUM"i            !ident_start    { return 'SUM';      }
KW_AVG            = "AVG"i            !ident_start    { return 'AVG';      }

KW_CAST           = val:"CAST"i        !ident_start { return makeKeywordNode(val, location()) }
KW_RECURSIVE      = val:"RECURSIVE"i   !ident_start { return makeKeywordNode(val, location()) }
KW_FOREIGN_KEY    = val:"FOREIGN KEY"i !ident_start { return makeKeywordNode(val, location()) }
KW_REFERENCES     = val:"REFERENCES"i  !ident_start { return makeKeywordNode(val, location()) }
KW_INDEX          = val:"INDEX"i       !ident_start { return makeKeywordNode(val, location()) }

KW_CASCADE        = val:"CASCADE"i     !ident_start { return makeKeywordNode(val, location()) }
KW_SET_NULL       = val:"SET NULL"i    !ident_start { return makeKeywordNode(val, location()) }
KW_SET_DEFAULT    = val:"SET DEFAULT"i !ident_start { return makeKeywordNode(val, location()) }
KW_RESTRICT       = val:"RESTRICT"i    !ident_start { return makeKeywordNode(val, location()) }
KW_NO_ACTION      = val:"NO ACTION"i   !ident_start { return makeKeywordNode(val, location()) }

KW_TYPE           = val:"TYPE"i        !ident_start { return makeKeywordNode(val, location()) }
KW_ENUM           = val:"ENUM"i        !ident_start { return makeKeywordNode(val, location()) }
KW_RANGE          = val:"RANGE"i       !ident_start { return makeKeywordNode(val, location()) }

//specail character
DOT       = '.'
COMMA     = ','
STAR      = '*'
LPAREN    = '('
RPAREN    = ')'
LBRAKE    = '['
RBRAKE    = ']'
LBRACE    = '{'
RBRACE    = '}'
DQUOTE    = '"'

__ =
  (whitespace / Comment)*

char = .

whitespace =
  [ \t\n\r]

Comment =
  SingleLineComment / MultiLineComment

SingleLineComment =
  "--" (!line_terminator char)*
MultiLineComment =
  "/*" (!"*/" char)* "*/"

EOL
  = EOF
  / [\n\r]+

EOF = !.
EOSQL = ';'

//begin procedure extension
proc_stmts
  = proc_stmt*

proc_stmt
  = &{ return true; } __ s:(assign_stmt / return_stmt) {
      return {
        stmt : s,
      }
    }

assign_stmt
  = va:var_decl __ KW_ASSIGN __ e:proc_expr {
    return {
      type : 'assign',
      left : va,
      right: e
    }
  }

return_stmt
  = KW_RETURN __ e:proc_expr {
  return {
    type : 'return',
    expr: e
  }
}

proc_expr
  = select_stmt
  / proc_join
  / proc_additive_expr
  / proc_array

proc_additive_expr
  = head:proc_multiplicative_expr
    tail:(__ additive_operator  __ proc_multiplicative_expr)* {
      return createBinaryExprChain(head, tail);
    }

proc_multiplicative_expr
  = head:proc_primary
    tail:(__ multiplicative_operator  __ proc_primary)* {
      return createBinaryExprChain(head, tail);
    }

proc_join
  = lt:var_decl __ op:join_op  __ rt:var_decl __ expr:on_clause {
      return {
        type    : 'join',
        ltable  : lt,
        rtable  : rt,
        op      : op,
        on      : expr
      }
    }

proc_primary
  = literal
  / var_decl
  / proc_func_call
  / special_system_function
  / param
  / LPAREN __ e:proc_additive_expr __ RPAREN {
      e.paren = true;
      return e;
    }

proc_func_call
  = name:ident __ LPAREN __ l:proc_primary_list __ RPAREN {
      //compatible with original func_call
      return {
        type : 'function',
        name : name,
        args : {
          type  : 'expr_list',
          value : l
        },
        location: location(),
      }
    }

special_system_function
  = value:(
    'CURRENT_USER'i        !ident_start
    / 'CURRENT_DATE'i      !ident_start
    / 'CURRENT_TIME'i      !ident_start
    / 'CURRENT_TIMESTAMP'i !ident_start
    / 'LOCALTIME'i         !ident_start
    / 'LOCALTIMESTAMP'i    !ident_start
    / 'SESSION_USER'i      !ident_start
    / 'SYSTEM_USER'i       !ident_start
    / 'USER'i              !ident_start
  ) {
      return {
        type : 'special_system_function',
        name : value,
        location: location(),
      }
    }

proc_primary_list
  = head:proc_primary tail:(__ COMMA __ proc_primary)* {
      return createList(head, tail);
    }

proc_array =
  LBRAKE __ l:proc_primary_list __ RBRAKE {
    return {
      type : 'array',
      value : l
    }
  }

var_decl = var_decl_std / var_decl_pg_promise

var_decl_std
  = KW_VAR_PRE name:ident_name m:mem_chain {
    return {
      type : 'var',
      name : name,
      members : m,
      location: location()
    }
  }

// ref: https://github.com/vitaly-t/pg-promise
var_decl_pg_promise
  = KW_VAR_PRE LBRACE name:ident_name m:mem_chain RBRACE {
    return {
      type : 'var_pg_promise',
      name : name,
      members : m,
      location: location()
    }
  }

mem_chain
  = l:('.' ident_name)* {
    var s = [];
    for (var i = 0; i < l.length; i++) {
      s.push(l[i][1]);
    }
    return s;
  }

 KW_VAR_PRE = '$'

 KW_RETURN = 'return'i

 KW_ASSIGN = ':='

delete_stmt
  = with_clause: with_clause? __
    val:KW_DELETE    __
    KW_FROM      __
    t:delete_table __
    w:where_clause? {
      return {
        type    : 'delete',
        with    : with_clause,
        table   : t,
        where   : w
      }
    }

delete_table
  = db:db_name __ DOT __ t:table_name {
      return  {
        type: 'table',
        db    : db,
        table : t,
        location: location()
      }
    }
  / t:table_name {
      return  {
        type: 'table',
        db    : '',
        table : t,
        location: location()
      }
    }

drop_table_stmt
  = keyword: drop_table_keyword __
    if_exists_keyword: KW_IF_EXISTS __
    table: delete_table __
    {
      return {
        type: 'drop_table',
        keyword: keyword,
        if_exists: if_exists_keyword,
        table: table
      }
    }
  / keyword: drop_table_keyword __
    table: delete_table __
   {
      return {
        type: 'drop_table',
        keyword: keyword,
        if_exists: null,
        table: table
      }
    }

drop_table_keyword
  = val: KW_DROP_TABLE {
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }

create_table_stmt
  = keyword: create_table_keyword __
    table: ident __
    as: KW_AS __
    select: select_stmt
   {
      return {
        type: 'create_table',
        keyword: keyword,
        if_not_exists: null,
        column_definitions: [],
        select: select,
        location: location(),
      }
    }
  / keyword: create_table_keyword __
    if_not_exists_keyword: if_not_exists_keyword __
    table: ident __
    LPAREN __
    fields: column_definition_list __
    RPAREN
   {
      return {
        type: 'create_table',
        keyword: keyword,
        if_not_exists: if_not_exists_keyword,
        column_definitions: fields,
        select: null,
        location: location(),
      }
    }
  / keyword: create_table_keyword __
    table: ident __
    LPAREN __
    fields: column_definition_list __
    RPAREN
   {
      return {
        type: 'create_table',
        if_not_exists: null,
        keyword: keyword,
        column_definitions: fields,
        select: null,
        location: location(),
      }
    }

create_table_keyword
  = val: KW_CREATE_TABLE {
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }

if_not_exists_keyword
  = val: KW_IF_NOT_EXISTS {
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }

column_definition = foreign_key / primary_key / field
column_definition_list = head: column_definition tail:(__ COMMA __ column_definition)* {
  return createList(head, tail);
}

field
  = name:ident __ type:field_data_type __ constraints: field_constraint_list {
    return {
      type: 'field',
      name: name,
      data_type: type,
      constraints: constraints,
      location: location()
    }
  }
  / name:ident __ type:field_data_type {
    return {
      type: 'field',
      name: name,
      data_type: type,
      constraints: [],
      location: location()
    }
  }

foreign_key
  = k1: KW_FOREIGN_KEY __
    LPAREN __ col_head:ident col_tail:(__ COMMA __ ident)* __ RPAREN __
    k2: KW_REFERENCES __ ref_table:ident __ LPAREN __ ref_col_head:ident ref_col_tail:(__ COMMA __ ident)* __ RPAREN __
    on:foreign_key_on? {
    return {
      type: 'foreign_key',
      foreign_keyword: k1,
      columns: createList(col_head, col_tail),
      references_keyword: k2,
      references_table: ref_table,
      references_columns: createList(ref_col_head, ref_col_tail),
      on: on,
      location: location()
    }
  }

foreign_key_on
  = on:KW_ON __
    trigger:(KW_DELETE/KW_UPDATE) __
    action:(KW_CASCADE/KW_SET_NULL/KW_SET_DEFAULT/KW_RESTRICT/KW_NO_ACTION) {
    return {
      type: 'foreign_key_on',
      on_keyword: on,
      trigger: trigger,
      action: action,
      location: location()
    }
  }

primary_key
  = k: KW_PRIMARY_KEY __ LPAREN __ col_head:ident col_tail:(__ COMMA __ ident)* __ RPAREN {
    return {
      type: 'primary_key',
      keyword: k,
      columns: createList(col_head, col_tail),
      location: location()
    }
  }

field_data_type
  = name:ident __ LPAREN __? args_head:int args_tail:(__ COMMA __ int)* __? RPAREN {
    return {
      type: 'field_data_type',
      name: name,
      args: createList(args_head, args_tail),
      location: location()
    }
  }
  / name:ident {
    return {
      type: 'field_data_type',
      name: name,
      args: [],
      location: location()
    }
  }

field_constraint_list
  = head:field_constraint tail:(__ field_constraint)* {
    return createList(head, tail, 1);
  }

field_constraint
  = field_constraint_not_null
  / field_constraint_primary_key
  / field_constraint_unique
  / field_constraint_auto_increment
  / field_constraint_generated
  / field_constraint_default

field_constraint_not_null = k: keyword_not_null {
  return { type: 'constraint_not_null', keyword: k, location: location() }
}
keyword_not_null = k: KW_NOT_NULL {
  return { type: 'keyword', value: k && k[0], location: location() }
}

field_constraint_primary_key = k: keyword_primary_key {
  return { type: 'constraint_primary_key', keyword: k, location: location() }
}
keyword_primary_key = k: KW_PRIMARY_KEY {
  return { type: 'keyword', value: k && k[0], location: location() }
}

field_constraint_unique = k: keyword_unique {
  return { type: 'constraint_unique', keyword: k, location: location() }
}
keyword_unique = k: KW_UNIQUE {
  return { type: 'keyword', value: k && k[0], location: location() }
}

field_constraint_auto_increment = k: keyword_auto_increment {
  return { type: 'constraint_auto_increment', keyword: k, location: location() }
}
keyword_auto_increment = k: KW_AUTO_INCREMENT {
  return { type: 'keyword', value: k && k[0], location: location() }
}

field_constraint_generated =
  g: KW_GENERATED __
  opt: constraint_generated_option __
  data: constraint_generated_data_type? __
  seq: sequence_option_list_wrap? {
    return { type: 'constraint_generated', option: opt, data_type: data, sequence_options: seq }
}

constraint_generated_option = k: keyword_always {
  return { type: 'constraint_generated_option', option: 'ALWAYS', keyword: k }
} / k: keyword_by_default {
  return { type: 'constraint_generated_option', option: 'BY_DEFAULT', keyword: k }
} / k: keyword_by_default_on_null {
  return { type: 'constraint_generated_option', option: 'BY_DEFAULT_ON_NULL', keyword: k }
}

field_constraint_default
  = k: KW_DEFAULT __
    value: (literal / proc_func_call / special_system_function) {
      return { type: 'constraint_default', keyword: k, value: value, location: location() }
}

keyword_always = k: KW_ALWAYS {
  return { type: 'keyword', value: k && k[0], location: location() }
}
keyword_by_default = k: KW_BY_DEFAULT {
  return { type: 'keyword', value: k && k[0], location: location() }
}
keyword_by_default_on_null = k: KW_BY_DEFAULT_ON_NULL {
  return { type: 'keyword', value: k && k[0], location: location() }
}

constraint_generated_data_type = KW_AS __ val:ident {
  return { type: 'sequence_option_data_type', value: val, location: location() }
}

sequence_option_list_wrap = sequence_option_list
/ s: (LPAREN __ sequence_option_list __ RPAREN) {
  return s[2]
}

sequence_option_list
  = head:sequence_option tail:(__ sequence_option)* {
    return createList(head, tail, 1);
  }

sequence_option =
  sequence_option_increment
  / sequence_option_start
  / sequence_option_maxvalue
  / sequence_option_minvalue
  / sequence_option_no_maxvalue
  / sequence_option_no_minvalue
  / sequence_option_cache
  / sequence_option_cycle
  / sequence_option_no_cycle
  / sequence_option_owned_by
  / sequence_option_owned_by_none


sequence_option_increment = KW_INCREMENT __ KW_BY __ val:int {
  return { type: 'sequence_option_increment', value: val, location: location() }
}
sequence_option_start = KW_START __ KW_WITH __ val:int {
  return { type: 'sequence_option_increment', value: val, location: location() }
}
sequence_option_maxvalue = KW_MAXVALUE __ val:int {
  return { type: 'sequence_option_maxvalue', value: val, location: location() }
}
sequence_option_minvalue = KW_MINVALUE __ val:int {
  return { type: 'sequence_option_maxvalue', value: val, location: location() }
}
sequence_option_no_maxvalue = KW_NO_MAXVALUE {
  return { type: 'sequence_option_no_maxvalue', location: location() }
}
sequence_option_no_minvalue = KW_NO_MINVALUE {
  return { type: 'sequence_option_no_minvalue', location: location() }
}
sequence_option_cache = KW_CACHE __ val: int {
  return { type: 'sequence_option_cache', value: val, location: location() }
}
sequence_option_cycle = KW_CYCLE {
  return { type: 'sequence_option_cycle', location: location() }
}
sequence_option_no_cycle = KW_NO_CYCLE {
  return { type: 'sequence_option_no_cycle', location: location() }
}
sequence_option_owned_by = KW_OWNED_BY __ val: column_ref {
  return { type: 'sequence_option_owned_by', value: val, location: location() }
}
sequence_option_owned_by_none = KW_OWNED_BY_NONE {
  return { type: 'sequence_option_owned_by_none', location: location() }
}

alter_table_stmt
  = keyword: alter_table_keyword __
    table: ident __
    command: (alter_table_add_column / alter_table_drop_column / alter_table_modify_column) {
      return {
        type: 'alter_table',
        keyword: keyword,
        table: table,
        command: command
      }
    }

alter_table_keyword
  = val: (KW_ALTER __ KW_TABLE) {
    return {
      type: 'keyword',
      value: (val || []).map((v) => (v && v[0]) || [], []).join(''),
      location: location()
    }
  }

alter_table_add_column
  = keyword: add_keyword __
    field: field {
      return {
        type: 'alter_table_add_column',
        keyword: keyword,
        field: field,
        location: location()
      }
    }

add_keyword
  = val: KW_ADD {
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }

alter_table_drop_column
  = keyword: drop_column_keyword __
    column: (column_node / !{error('EXPECTED COLUMN NAME')}) {
      return {
        type: 'alter_table_drop_column',
        keyword: keyword,
        column: column,
        location: location()
      }
    }

drop_column_keyword
  = val: KW_DROP_COLUMN {
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }

alter_table_modify_column
  = keyword: modify_keyword __
    field: (field / !{error('EXPECTED COLUMN NAME')}) {
      return {
        type: 'alter_table_modify_column',
        keyword: keyword,
        field: field,
        location: location()
      }
    }

modify_keyword
  = val: (KW_MODIFY __ KW_COLUMN) {
    return {
      type: 'keyword',
      value: (val || []).map((v) => (v && v[0]) || [], []).join(''),
      location: location()
    }
  }
  / val: KW_MODIFY {
    const ary = val || []
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
  }
  / val: (KW_ALTER __ KW_COLUMN) {
    return {
      type: 'keyword',
      value: (val || []).map((v) => (v && v[0]) || [], []).join(''),
      location: location()
    }
  }

create_index_stmt
  = kw_create: KW_CREATE __
    kw_index: KW_INDEX __
    kw_if_not_exists: KW_IF_NOT_EXISTS? __
    name: ident __
    kw_on: KW_ON __
    table: ident __
    LPAREN __ columns: column_list __ RPAREN {
    return {
      type: 'create_index',
      create_keyword: kw_create,
      index_keyword: kw_index,
      if_not_exists_keyword: kw_if_not_exists,
      if_not_exists: !!kw_if_not_exists,
      name: name,
      on_keyword: kw_on,
      table: table,
      columns: columns,
      location: location()
    }
  }

drop_index_stmt
  = kw_drop: KW_DROP __
    kw_index: KW_INDEX __
    kw_concurrently: KW_CONCURRENTLY? __
    kw_if_exists: KW_IF_EXISTS? __
    names: ident_list __
    dependency_action: (KW_CASCADE / KW_RESTRICT)?
    {
      return {
        type: 'drop_index',
        drop_keyword: kw_drop,
        index_keyword: kw_index,
        if_exists_keyword: kw_if_exists,
        if_exists: !!kw_if_exists,
        concurrently_keyword: kw_concurrently,
        concurrently: !!kw_concurrently,
        dependency_action: dependency_action || null,
        names: names,
        location: location()
      }
    }

create_type_stmt
  = create_type_stmt_composite / create_type_stmt_enum / create_type_stmt_range / create_type_stmt_base

create_type_stmt_composite =
  kw_create: KW_CREATE __
  kw_type: KW_TYPE __
  name: ident __
  kw_as: KW_AS __
  LPAREN __
  fields: composite_type_field_list __
  RPAREN {
    return {
      type: 'create_type',
      type_variant: 'composite_type',
      create_keyword: kw_create,
      type_keyword: kw_type,
      name: name,
      as_keyword: kw_as,
      fields: fields,
      location: location()
    }
  }

composite_type_field =
  name:ident __ type:field_data_type {
    return {
      type: 'composite_type_field',
      name: name,
      data_type: type,
      location: location()
    }
  }

composite_type_field_list =
  head:composite_type_field tail:(__ COMMA __ composite_type_field)* {
    return createList(head, tail);
  }

create_type_stmt_enum =
  kw_create: KW_CREATE __
  kw_type: KW_TYPE __
  name: ident __
  kw_as: KW_AS __
  kw_enum: KW_ENUM __
  LPAREN __
  values: create_type_value_list __
  RPAREN {
    return {
      type: 'create_type',
      type_variant: 'enum_type',
      create_keyword: kw_create,
      type_keyword: kw_type,
      name: name,
      as_keyword: kw_as,
      enum_keyword: kw_enum,
      values: values,
      location: location()
    }
  }

create_type_value_list =
  head:literal_string tail:(__ COMMA __ literal_string)* {
    return createList(head, tail);
  }

create_type_stmt_range =
  kw_create: KW_CREATE __
  kw_type: KW_TYPE __
  name: ident __
  kw_as: KW_AS __
  kw_range: KW_RANGE __
  LPAREN __
  values: assign_value_expr_list __
  RPAREN {
    return {
      type: 'create_type',
      type_variant: 'range_type',
      create_keyword: kw_create,
      type_keyword: kw_type,
      name: name,
      as_keyword: kw_as,
      range_keyword: kw_range,
      values: values,
      location: location()
    }
  }

assign_value_expr =
  name:ident __ "=" __ val:(ident / literal_numeric) {
    if (val.type === 'number') {
      val = val.value
    }
    return {
      type: 'assign_value_expr',
      name: name,
      value: val,
      location: location()
    }
  } /
  name:ident {
    return {
      type: 'assign_value_expr',
      name: name,
      value: true,
      location: location()
    }
  }

assign_value_expr_list =
  head:assign_value_expr tail:(__ COMMA __ assign_value_expr)* {
    return createList(head, tail);
  }

create_type_stmt_base =
  kw_create: KW_CREATE __
  kw_type: KW_TYPE __
  name: ident __
  values:(
    LPAREN __
    assign_value_expr_list __
    RPAREN
  )? {
    return {
      type: 'create_type',
      type_variant: 'base_type',
      create_keyword: kw_create,
      type_keyword: kw_type,
      name: name,
      values: (values && values[2]) || [],
      location: location()
    }
  }

drop_type_stmt =
  kw_drop: KW_DROP __
  kw_type: KW_TYPE __
  kw_if_exists: KW_IF_EXISTS? __
  names: ident_list __
  dependency_action: (KW_CASCADE / KW_RESTRICT)?
  {
    return {
      type: 'drop_type',
      drop_keyword: kw_drop,
      type_keyword: kw_type,
      names: names,
      if_exists: kw_if_exists || null,
      dependency_action: dependency_action || null,
      location: location()
    }
  }
