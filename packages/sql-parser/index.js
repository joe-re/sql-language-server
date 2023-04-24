const Parser = require('./base/parser');
const FromClauseParser = require('./base/fromClauseParser')
Parser.reservedMap = require('./base/reservedmap');
FromClauseParser.reservedMap = require('./base/reservedmap');

exports.parse = function (sql){
  var ap = Parser.parse(sql);
  return ap.ast;
};

exports.parseAll = function (sql) {
  var ap = Parser.parse(sql);
  return ap.asts;
}

exports.parseFromClause = function (sql) {
  return FromClauseParser.parse(sql)
}

module.exports = {
  parse: exports.parse,
  parseFromClause: exports.parseFromClause,
  parseAll: exports.parseAll,
}
