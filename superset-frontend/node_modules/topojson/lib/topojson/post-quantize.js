var quantize = require("./quantize");

module.exports = function(topology, Q0, Q1) {
  if (Q0) {
    if (Q1 === Q0 || !topology.bbox.every(isFinite)) return topology;
    var k = Q1 / Q0,
        q = quantize(0, 0, k, k);

    topology.transform.scale[0] /= k;
    topology.transform.scale[1] /= k;
  } else {
    var bbox = topology.bbox,
        x0 = isFinite(bbox[0]) ? bbox[0] : 0,
        y0 = isFinite(bbox[1]) ? bbox[1] : 0,
        x1 = isFinite(bbox[2]) ? bbox[2] : 0,
        y1 = isFinite(bbox[3]) ? bbox[3] : 0,
        kx = x1 - x0 ? (Q1 - 1) / (x1 - x0) : 1,
        ky = y1 - y0 ? (Q1 - 1) / (y1 - y0) : 1,
        q = quantize(-x0, -y0, kx, ky);

    topology.transform = q.transform;
  }

  function quantizeGeometry(geometry) {
    if (geometry && quantizeGeometryType.hasOwnProperty(geometry.type)) quantizeGeometryType[geometry.type](geometry);
  }

  var quantizeGeometryType = {
    GeometryCollection: function(o) { o.geometries.forEach(quantizeGeometry); },
    Point: function(o) { q.point(o.coordinates); },
    MultiPoint: function(o) { o.coordinates.forEach(q.point); }
  };

  for (var key in topology.objects) {
    quantizeGeometry(topology.objects[key]);
  }

  // XXX shared points are bad mmkay
  topology.arcs = topology.arcs.map(function(arc) {
    q.line(arc = arc.map(function(point) { return point.slice(); }));
    if (arc.length < 2) arc.push(arc[0]); // arcs must have at least two points
    return arc;
  });

  return topology;
};
