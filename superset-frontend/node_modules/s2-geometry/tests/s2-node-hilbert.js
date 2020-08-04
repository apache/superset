var s2n = require('s2geometry-node');

// Provo, UT (Center St)
//var lat = 40.2574448;
//var lng = -111.7089464;

// Startup Building in Provo
//var lat = 40.2262363;
//var lng = -111.6630927;

// Kyderman's test location
//var lat = 51.352085106718384;
//var lng = -2.9877930879592896;

// Toeler's test location
var lat = -43.5261282;
var lng = 172.6561085;

var s2nlatlng = new s2n.S2LatLng(lat, lng);
var cellId = new s2n.S2CellId(s2nlatlng).parent(15);
var cell;

var walk = [];
var next = cellId;
var prev = cellId;
var i;

// -10 - -1
for (i = 0; i < 10; i += 1) {
  prev = prev.prev();

  walk.unshift([ -(i + 1), prev ]);
}

// 0
walk.push([ 0, cellId ]);

// 1 - 10
for (i = 0; i < 10; i += 1) {
  next = next.next();

  walk.push([ i + 1, next ]);
}

// all results
walk.forEach(function (parts) {
  var i = parts[0];
  var cellId = parts[1];

  cell = new s2n.S2Cell(cellId);
  console.log(i, cell.face(), cellId.id(), cellId.toString(), cellId.toLatLng().toString(), cellId.level());
});
