var type = require("./type"),
    systems = require("./coordinate-systems"),
    topojson = require("../../build/topojson");

module.exports = function(object, options) {
  if (object.type === "Topology") clockwiseTopology(object, options);
  else clockwiseGeometry(object, options);
};

function clockwiseGeometry(object, options) {
  var system = null;

  if (options)
    "coordinate-system" in options && (system = systems[options["coordinate-system"]]);

  var clockwisePolygon = clockwisePolygonSystem(system.ringArea, reverse);

  type({
    LineString: noop,
    MultiLineString: noop,
    Point: noop,
    MultiPoint: noop,
    Polygon: function(polygon) { clockwisePolygon(polygon.coordinates); },
    MultiPolygon: function(multiPolygon) { multiPolygon.coordinates.forEach(clockwisePolygon); }
  }).object(object);

  function reverse(array) { array.reverse(); }
}

function clockwiseTopology(topology, options) {
  var system = null;

  if (options)
    "coordinate-system" in options && (system = systems[options["coordinate-system"]]);

  var clockwisePolygon = clockwisePolygonSystem(ringArea, reverse);

  var clockwise = type({
    LineString: noop,
    MultiLineString: noop,
    Point: noop,
    MultiPoint: noop,
    Polygon: function(polygon) { clockwisePolygon(polygon.arcs); },
    MultiPolygon: function(multiPolygon) { multiPolygon.arcs.forEach(clockwisePolygon); }
  });

  for (var key in topology.objects) {
    clockwise.object(topology.objects[key]);
  }

  function ringArea(ring) {
    return system.ringArea(topojson.feature(topology, {type: "Polygon", arcs: [ring]}).geometry.coordinates[0]);
  }

  // TODO It might be slightly more compact to reverse the arc.
  function reverse(ring) {
    var i = -1, n = ring.length;
    ring.reverse();
    while (++i < n) ring[i] = ~ring[i];
  }
};

function clockwisePolygonSystem(ringArea, reverse) {
  return function(rings) {
    if (!(n = rings.length)) return;
    var n,
        areas = new Array(n),
        max = -Infinity,
        best,
        area,
        t;
    // Find the largest absolute ring area; this should be the exterior ring.
    for (var i = 0; i < n; ++i) {
      var area = Math.abs(areas[i] = ringArea(rings[i]));
      if (area > max) max = area, best = i;
    }
    // Ensure the largest ring appears first.
    if (best) {
      t = rings[best], rings[best] = rings[0], rings[0] = t;
      t = areas[best], areas[best] = areas[0], areas[0] = t;
    }
    if (areas[0] < 0) reverse(rings[0]);
    for (var i = 1; i < n; ++i) {
      if (areas[i] > 0) reverse(rings[i]);
    }
  };
}

function noop() {}
