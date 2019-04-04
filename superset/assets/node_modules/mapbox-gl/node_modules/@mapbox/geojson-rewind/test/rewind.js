var rewind = require('../'),
    fs = require('fs'),
    test = require('tape');
    hint = require('@mapbox/geojsonhint').hint;

function f(_) {
    return JSON.parse(fs.readFileSync(_, 'utf8'));
}

function fixture(t, name, title) {
    var result = rewind(f(name));
    var outputName = name.replace('.input.', '.output.');
    if (process.env.UPDATE) {
        var errors = hint(result)
        if (errors.length) {
            errors.forEach(function (e) {
              t.fail(outputName + 'line ' + e.line + ' - ' + e.message + ' - ' + e.level || 'error');
            })
        } else {
            fs.writeFileSync(outputName, JSON.stringify(result, null, 4));
        }
    }
    var expect = f(outputName);
    t.deepEqual(result, expect, title);
}

test('rewind', function(t) {
    fixture(t, __dirname + '/fixture/featuregood.input.geojson', 'feature-good');
    fixture(t, __dirname + '/fixture/flip.input.geojson', 'flip');
    fixture(t, __dirname + '/fixture/collection.input.geojson', 'feature-collection');
    fixture(t, __dirname + '/fixture/geomcollection.input.geojson', 'geometry-collection');
    fixture(t, __dirname + '/fixture/multipolygon.input.geojson', 'multipolygon');
    fixture(t, __dirname + '/fixture/rev.input.geojson', 'rev');
    t.end();
});

test('passthrough', function(t) {
    t.equal(rewind(null), null);
    t.end();
});
