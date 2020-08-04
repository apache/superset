var gjArea = require('../'),
    test = require('tape'),
    ill = require('./illinois.json'),
    all = require('./all.json');

test('geojson area', function(t) {
    t.test('computes the area of illinois', function(t) {
        t.equal(gjArea.geometry(ill), 145978332359.36746);
        t.end();
    });
    // http://www.wolframalpha.com/input/?i=surface+area+of+earth
    t.test('computes the area of the world', function(t) {
        t.equal(gjArea.geometry(all), 511207893395811.06);
        t.end();
    });
    t.test('point has zero area', function(t) {
        t.equal(gjArea.geometry({ type: 'Point', coordinates: [0,0] }), 0);
        t.end();
    });
    t.test('linestring has zero area', function(t) {
        t.equal(gjArea.geometry({ type: 'LineString', coordinates: [[0,0],[1,1]] }), 0);
        t.end();
    });
    t.test('geometrycollection is the sum', function(t) {
        t.equal(gjArea.geometry({ type: 'GeometryCollection', geometries: [all, ill] }), 511353871728170.44);
        t.end();
    });
    t.end();
});
