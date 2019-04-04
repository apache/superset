var Pbf = require('pbf'),
    VectorTile = require('..').VectorTile,
    Benchmark = require('benchmark'),
    fs = require('fs');

var suite = new Benchmark.Suite(),
    data = fs.readFileSync(__dirname + '/fixtures/14-8801-5371.vector.Pbf');

readTile(); // output any errors before running the suite
readTile(true);

suite
.add('read tile with geometries', function() {
    readTile(true);
})
.add('read tile without geometries', function() {
    readTile();
})
.on('cycle', function(event) {
    console.log(String(event.target));
})
.run();


function readTile(loadGeom, loadPacked) {
    var buf = new Pbf(data),
        vt = new VectorTile(buf);

    for (var id in vt.layers) {
        var layer = vt.layers[id];
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            if (loadGeom) feature.loadGeometry();
        }
    }
}
