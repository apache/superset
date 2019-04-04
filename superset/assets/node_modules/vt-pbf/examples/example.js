var fs = require('fs')
var geojsonVt = require('geojson-vt')
var vtpbf = require('../')

// Example: read geojson from a file and write a protobuf
// Usage: node example.js filename.geojson z x y > tile.z.x.y.pbf

var orig = JSON.parse(fs.readFileSync(process.argv[2]))
var tileindex = geojsonVt(orig)

var z = +process.argv[3]
var x = +process.argv[4]
var y = +process.argv[5]
var tile = tileindex.getTile(z, x, y)

var buff = vtpbf.fromGeojsonVt(tile, 'geojsonLayer')
process.stdout.write(buff)
