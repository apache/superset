var test = require('tap').test;
var browserify = require('browserify');
var path = require('path');

test('dynamically loaded file gets skipped', function (t) {
    t.plan(1);
    
    var b = browserify();
    b.add(__dirname + '/files/dynamic_read_concat');
    b.transform(path.dirname(__dirname));
    
    b.bundle(function (err, src) {
        if (err) t.fail(err);
        else t.ok(true, 'build success');
    });

});
