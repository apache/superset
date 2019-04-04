var rewind = require('../'),
    fs = require('fs'),
    test = require('tape');

function f(_) {
    return JSON.parse(fs.readFileSync(_, 'utf8'));
}

function fixture(t, name, title) {
    var result = rewind(f(name));
    var outputName = name.replace('.input.', '.output.');
    if (process.env.UPDATE) {
        fs.writeFileSync(outputName, JSON.stringify(result, 4));
    }
    var expect = f(outputName);
    t.deepEqual(result, expect, title);
}

test('rewind', function(t) {
    fixture(t, __dirname + '/fixture/featuregood.input.geojson', 'feature-good');
    fixture(t, __dirname + '/fixture/flip.input.geojson', 'flip');
    fixture(t, __dirname + '/fixture/collection.input.geojson', 'collection');
    fixture(t, __dirname + '/fixture/multipolygon.input.geojson', 'multipolygon');
    fixture(t, __dirname + '/fixture/rev.input.geojson', 'rev');
    t.end();
});

test('passthrough', function(t) {
    t.equal(rewind(null), null);
    t.end();
});
