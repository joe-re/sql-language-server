// import nQueryParser from 'node-query/base/nquery'
var dc = {
  columns :  [
    'name' , 'type', 'shop_id', 'title', 'money'
  ],
  data  : [
    ['edward', 'a', 1, 'spring', 100],
    ['bob',    'b', 2, 'spring', 100],
    ['alice',  'b', 3, 'spring', 120],
    ['selly',  'b', 4, 'spring', 120],
    ['kikyou', 'c', 5, 'summer', 220],
    ['kobe',   'c', 6, 'summer', 320],
    ['onesa',  'd', 8, 'summer', 320],
    ['miller', 'd', 9, 'summer', 320]
  ]
}

var doSelectFilter = Executor.doSelectFilter;

function run(str) {
  var ast = Parser.parse(str);
  var ar  = new AstReader(ast);
  console.log(ast)
  console.log(ar.getAst());
  console.log(ar.getAst().columns);
  console.log(ar.getAsNames());
  console.log(AstHelper.getRefColInfo(ar.getAst()));
}
try {
  run('SELECT DISTINCT a FROM b WHERE c = 0 GROUP BY d ORDER BY e limit 3');
} catch (e) {
  console.log(e)
}
