var falafel = require('../');
var test = require('tape');
var semver = require('semver');

// it runs the generator so needs node 4+
test('generators', { skip: semver.satisfies(process.version, '< 4.0.0') }, function (t) {
    t.plan(1);
    
    var src = 'console.log((function * () { yield 3 })().next().value)';
    var output = falafel(src, { ecmaVersion: 6 }, function (node) {
        if (node.type === 'Literal') {
            node.update('555');
        }
    });
    Function(['console'],output)({log:log});
    function log (n) { t.equal(n, 555) }
});
