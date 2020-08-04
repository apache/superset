var test = require('tape');
var evaluate = require('../');
var parse = require('esprima').parse;

test('untagged template strings', function (t) {
    t.plan(1);
    
    var src = '`${1},${2 + n},${`4,5`}`';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {
        n: 6
    });
    t.deepEqual(res, '1,8,4,5');
});

test('tagged template strings', function (t) {
    t.plan(3);

    var src = 'template`${1},${2 + n},${`4,5`}`';
    var ast = parse(src).body[0].expression;
    var res = evaluate(ast, {
        template: function (strings) {
            t.deepEqual(strings, ['', ',', ',', '']);

            var values = [].slice.call(arguments, 1);
            t.deepEqual(values, [1, 8, '4,5']);

            return 'foo';
        },
        n: 6
    });
    t.deepEqual(res, 'foo');
})
