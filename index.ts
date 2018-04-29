import nQuery from 'node-query'

var Parser    = nQuery.Parser;
var Executor  = nQuery.Executor;
var AstReader = nQuery.AstReader;

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

  console.log(ar.getAst().columns);
}
try {
  run('SELECT hoge.hoge from hoge where hohoho');
} catch (e) {
  console.log(e)
}
