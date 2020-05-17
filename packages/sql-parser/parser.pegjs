// (C) 2011-2012 Alibaba Group Holding Limited.
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License 
// version 2 as published by the Free Software Foundation. 

// Author :windyrobin <windyrobin@Gmail.com>

{
  var util = require('util');
  var reservedMap = module.exports.reservedMap || {};

  function debug(str){
    console.log(str);
  }

  function inspect(obj){
    console.log(util.inspect(obj, false, 10));
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

  function createList(head, tail) {
    var result = [head];
    for (var i = 0; i < tail.length; i++) {
      result.push(tail[i][3]);
    }
    return result;
  }

  function createExprList(head, tail, room) {
    var epList = createList(head, tail);
    var exprList  = [];
    var ep;
    for (var i = 0; i < epList.length; i++) {
      ep = epList[i]; 
      //the ep has already added to the global params
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

  var cmpPrefixMap = {
    '+' : true,
    '-' : true,
    '*' : true,
    '/' : true,
    '>' : true,
    '<' : true,
    '!' : true,
    '=' : true,

    //between
    'B' : true,
    'b' : true,
    //for is or in
    'I' : true,
    'i' : true,
    //for like
    'L' : true,
    'l' : true,
    //for not
    'N' : true, 
    'n' : true, 
    //for contains
    'C' : true, 
    'c' : true, 
  }

  //used for store refered parmas
  var params = [];

  //used for dependency analysis
  var varList = [];
}

start 
  = &{ params = []; return true; } __ ast:(union_stmt  / update_stmt / replace_insert_stmt ) {
      return {
        ast   : ast,
        param : params
      } 
    } 
    /ast:proc_stmts {
      return {
        ast : ast  
      }
    }

union_stmt
  = head:select_stmt tail:(__ KW_UNION __ select_stmt)* {
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

select_stmt_nake
  = val:select_keyword  __
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
    return {
      type: 'keyword',
      value: val && val[0],
      location: location()
    }
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
  = db:db_name __ DOT __ t:table_name __ KW_AS? __ alias:ident? {
      if (t && t.type == 'var') {
        t.as = alias;
        return t;
      } else {
        return  {
          type: 'table',
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
  / text:(LPAREN __ table:table_base __ RPAREN) __ KW_AS? __ alias:ident? {
      return  { type: 'subquery', subquery: table, as: alias, location: location() };
    }
  / text:(LPAREN __ ([^)]* {return text()}) __ RPAREN) __ KW_AS? __ alias:ident? {
      return  { type: 'incomplete_subquery', text: text.join(''), as: alias, location: location() };
    }

join_op
  = KW_LEFT __ KW_JOIN { return 'LEFT JOIN'; }
  / (KW_INNER __)? KW_JOIN { return 'INNER JOIN'; }

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
  = KW_UPDATE    __
    db:db_name   __ DOT __
    t:table_name __
    KW_SET       __
    l:set_list   __
    w:where_clause? {
      return {
        type  : 'update',
        db    : db,
        table : t,
        set   : l,
        where : w
      }
    }
  / KW_UPDATE    __
    t:table_name __
    KW_SET       __
    l:set_list   __
    w:where_clause? {
      return {
        type  : 'update',
        db    : '',
        table : t,
        set   : l,
        where : w
      }
    }

set_list
  = head:set_item tail:(__ COMMA __ set_item)*  {
      return createList(head, tail);
    }

/**
 * here only use `additive_expr` to support 'col1 = col1+2'
 * if you want to use lower operator, please use '()' like below
 * 'col1 = (col2 > 3)'
 */
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

replace_insert_stmt
  = ri:replace_insert       __
    KW_INTO                 __
    db:db_name    __  DOT   __
    t:table_name  __
    c:insert_column_list __
    v:value_clause             {
      return {
        type      : ri,
        db        : db,
        table     : t,
        columns   : c,
        values    : v
      }
    }
  / ri:replace_insert       __
    KW_INTO                 __
    db:db_name       __ DOT __
    t:table_name            __
    KW_SET                  __
    l:set_list              __
    u:on_duplicate_key_update? {
      var v = {
        type  : ri,
        db    : db,
        table : t,
        set   : l
      };

      if (u) {
        v.duplicateSet = u;
      }

      return v;
    }
  / ri:replace_insert       __
    KW_INTO                 __
    t:table_name  __
    c:insert_column_list __
    v:value_clause             {
      return {
        type      : ri,
        db        : '',
        table     : t,
        columns   : c,
        values    : v
      }
    }
  / ri:replace_insert       __
    KW_INTO                 __
    t:table_name            __
    KW_SET                  __
    l:set_list              __
    u:on_duplicate_key_update? {
      var v = {
        type  : ri,
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
  = KW_VALUES __ l:value_list  { return l; }

on_duplicate_key_update
  = KW_ON __ KW_DUPLICATE __ KW_KEY __ KW_UPDATE __ l:set_list {
    return l;
  }

value_list
  = head:value_item tail:(__ COMMA __ value_item)* {
      return createList(head, tail);
    } 

value_item
  = LPAREN __ l:expr_list  __ RPAREN {
      return l;
    }

//for template auto fill
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

/** 
 * Borrowed from PL/SQL ,the priority of below list IS ORDER BY DESC 
 * ---------------------------------------------------------------------------------------------------
 * | +, -                                                     | identity, negation                   |     
 * | *, /                                                     | multiplication, division             |
 * | +, -                                                     | addition, subtraction, concatenation |
 * | =, <, >, <=, >=, <>, !=, IS, LIKE, BETWEEN, IN, CONTAINS | comparion                            |
 * | !, NOT                                                   | logical negation                     |
 * | AND                                                      | conjunction                          |
 * | OR                                                       | inclusion                            |      
 * ---------------------------------------------------------------------------------------------------
 */

expr = or_expr
    
or_expr
  = head:and_expr tail:(__ KW_OR __ and_expr)* {
      return createBinaryExprChain(head, tail);
    }

and_expr
  = head:not_expr tail:(__ KW_AND __ not_expr)* {
      return createBinaryExprChain(head, tail);
    }

//here we should use `NOT` instead of `comparision_expr` to support chain-expr
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

/* 
//optimization for comparison judge, bug because we in use `additive` expr
//in column clause now , it have little effect
cmp_prefix_char
  = c:char &{ debug(c); return cmpPrefixMap[c]; }

comparison_op_right 
  = &cmp_prefix_char  body:(
      arithmetic_op_right
      / in_op_right
      / between_op_right 
      / is_op_right
      / like_op_right
      / contains_op_right
    ){
      return body; 
    }
*/

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

is_op_right
  = op:KW_IS __ right:additive_expr {
      return {
        op    : op,   
        right : right
      }
    }

between_op_right
  = op:KW_BETWEEN __  begin:additive_expr __ KW_AND __ end:additive_expr {
      return {
        op    : op,
        right : {
          type : 'expr_list',
          value : [begin, end]
        }
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

column = 
  name:column_name !{ return reservedMap[name.toUpperCase()] === true; } {
    return name;
  }
  / '`' chars:[^`]+ '`' {
    return chars.join('');
  }

column_name 
  =  start:ident_start parts:column_part* { return start + parts.join(''); }

ident_name  
  =  start:ident_start parts:ident_part* { return start + parts.join(''); }

ident_start = [A-Za-z_]

ident_part  = [A-Za-z0-9_]

//to support column name like `cf1:name` in hbase
column_part  = [A-Za-z0-9_:]


param 
  = l:(':' ident_name) { 
    var p = {
      type : 'param',
      value: l[1]
    } 
    //var key = 'L' + line + 'C' + column;
    //debug(key);
    //params[key] = p;
    params.push(p);
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
        } 
      }   
    }

KW_SUM_MAX_MIN_AVG
  = KW_SUM / KW_MAX / KW_MIN / KW_AVG 

aggr_fun_count 
  = name:KW_COUNT __ LPAREN __ arg:count_arg __ RPAREN {
      return {
        type : 'aggr_func',
        name : name,
        args : arg 
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

func_call
  = name:ident __ LPAREN __ l:expr_list_or_empty __ RPAREN {
      return {
        type : 'function',
        name : name, 
        args : l
      }
    }

literal 
  = literal_string / literal_numeric / literal_bool /literal_null

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


KW_NULL      = "NULL"i     !ident_start
KW_TRUE      = "TRUE"i     !ident_start
KW_FALSE     = "FALSE"i    !ident_start

KW_SHOW      = "SHOW"i     !ident_start
KW_DROP      = "DROP"i     !ident_start
KW_SELECT    = "SELECT"i   !ident_start
KW_UPDATE    = "UPDATE"i   !ident_start
KW_CREATE    = "CREATE"i   !ident_start
KW_DELETE    = "DELETE"i   !ident_start
KW_INSERT    = "INSERT"i   !ident_start
KW_REPLACE   = "REPLACE"i  !ident_start
KW_EXPLAIN   = "EXPLAIN"i  !ident_start

KW_INTO      = "INTO"i     !ident_start
KW_FROM      = "FROM"i     !ident_start
KW_SET       = "SET"i      !ident_start

KW_AS        = "AS"i       !ident_start
KW_TABLE     = "TABLE"i    !ident_start

KW_ON        = "ON"i       !ident_start
KW_LEFT      = "LEFT"i     !ident_start
KW_INNER     = "INNER"i    !ident_start
KW_JOIN      = "JOIN"i     !ident_start
KW_UNION     = "UNION"i    !ident_start
KW_VALUES    = "VALUES"i   !ident_start

KW_EXISTS    = "EXISTS"i   !ident_start

KW_WHERE     = "WHERE"i    !ident_start

KW_GROUP     = "GROUP"i    !ident_start
KW_BY        = "BY"i       !ident_start
KW_ORDER     = "ORDER"i    !ident_start
KW_HAVING    = "HAVING"i   !ident_start

KW_LIMIT     = "LIMIT"i    !ident_start

KW_ASC       = "ASC"i      !ident_start    { return 'ASC';      }
KW_DESC      = "DESC"i     !ident_start    { return 'DESC';     }

KW_ALL       = "ALL"i      !ident_start    { return 'ALL';      }
KW_DISTINCT  = "DISTINCT"i !ident_start    { return 'DISTINCT'; }
KW_DUPLICATE = "DUPLICATE"i!ident_start    { return 'DUPLICATE';}
KW_BETWEEN   = "BETWEEN"i  !ident_start    { return 'BETWEEN';  }
KW_IN        = "IN"i       !ident_start    { return 'IN';       }
KW_IS        = "IS"i       !ident_start    { return 'IS';       }
KW_LIKE      = "LIKE"i     !ident_start    { return 'LIKE';     }
KW_CONTAINS  = "CONTAINS"i !ident_start    { return 'CONTAINS'; }
KW_KEY       = "KEY"i      !ident_start    { return 'KEY';      }

KW_NOT       = "NOT"i      !ident_start    { return 'NOT';      }
KW_AND       = "AND"i      !ident_start    { return 'AND';      }
KW_OR        = "OR"i       !ident_start    { return 'OR';       }

KW_COUNT     = "COUNT"i    !ident_start    { return 'COUNT';    }
KW_MAX       = "MAX"i      !ident_start    { return 'MAX';      }
KW_MIN       = "MIN"i      !ident_start    { return 'MIN';      }
KW_SUM       = "SUM"i      !ident_start    { return 'SUM';      }
KW_AVG       = "AVG"i      !ident_start    { return 'AVG';      }

//specail character
DOT       = '.'
COMMA     = ','
STAR      = '*'
LPAREN    = '('
RPAREN    = ')'

LBRAKE    = '['
RBRAKE    = ']'

__ =
  whitespace*

char = .

whitespace =
  [ \t\n\r]

EOL 
  = EOF
  / [\n\r]+
  
EOF = !.

//begin procedure extension
proc_stmts 
  = proc_stmt* 

proc_stmt 
  = &{ varList = []; return true; } __ s:(assign_stmt / return_stmt) {
      return {
        stmt : s,
        vars: varList
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
        }
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


var_decl 
  = KW_VAR_PRE name:ident_name m:mem_chain {
    //push for analysis
    varList.push(name);
    return {
      type : 'var',
      name : name,
      members : m
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
