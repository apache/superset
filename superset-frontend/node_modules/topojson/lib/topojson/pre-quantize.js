var quantize = require("./quantize");

module.exports = function(objects, bbox, Q0, Q1) {
  if (arguments.length < 4) Q1 = Q0;

  var x0 = isFinite(bbox[0]) ? bbox[0] : 0,
      y0 = isFinite(bbox[1]) ? bbox[1] : 0,
      x1 = isFinite(bbox[2]) ? bbox[2] : 0,
      y1 = isFinite(bbox[3]) ? bbox[3] : 0,
      kx = x1 - x0 ? (Q1 - 1) / (x1 - x0) * Q0 / Q1 : 1,
      ky = y1 - y0 ? (Q1 - 1) / (y1 - y0) * Q0 / Q1 : 1,
      q = quantize(-x0, -y0, kx, ky);

  function quantizeGeometry(geometry) {
    if (geometry && quantizeGeometryType.hasOwnProperty(geometry.type)) quantizeGeometryType[geometry.type](geometry);
  }

  var quantizeGeometryType = {
    GeometryCollection: function(o) { o.geometries.forEach(quantizeGeometry); },
    Point: function(o) { q.point(o.coordinates); },
    MultiPoint: function(o) { o.coordinates.forEach(q.point); },
    LineString: function(o) {
      var line = o.coordinates;
      q.line(line);
      if (line.length < 2) line[1] = line[0]; // must have 2+
    },
    MultiLineString: function(o) {
      for (var lines = o.coordinates, i = 0, n = lines.length; i < n; ++i) {
        var line = lines[i];
        q.line(line);
        if (line.length < 2) line[1] = line[0]; // must have 2+
      }
    },
    Polygon: function(o) {
      for (var rings = o.coordinates, i = 0, n = rings.length; i < n; ++i) {
        var ring = rings[i];
        q.line(ring);
        while (ring.length < 4) ring.push(ring[0]); // must have 4+
      }
    },
    MultiPolygon: function(o) {
      for (var polygons = o.coordinates, i = 0, n = polygons.length; i < n; ++i) {
        for (var rings = polygons[i], j = 0, m = rings.length; j < m; ++j) {
          var ring = rings[j];
          q.line(ring);
          while (ring.length < 4) ring.push(ring[0]); // must have 4+
        }
      }
    }
  };

  for (var key in objects) {
    quantizeGeometry(objects[key]);
  }

  return q.transform;
};
