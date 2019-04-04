d3.geo.project = function(object, projection) {
  var stream = projection.stream;
  if (!stream) throw new Error("not yet supported");
  return (object && d3_geo_projectObjectType.hasOwnProperty(object.type)
      ? d3_geo_projectObjectType[object.type]
      : d3_geo_projectGeometry)(object, stream);
};

function d3_geo_projectFeature(object, stream) {
  return {
    type: "Feature",
    id: object.id,
    properties: object.properties,
    geometry: d3_geo_projectGeometry(object.geometry, stream)
  };
}

function d3_geo_projectGeometry(geometry, stream) {
  if (!geometry) return null;

  if (geometry.type === "GeometryCollection") return {
    type: "GeometryCollection",
    geometries: object.geometries.map(function(geometry) {
      return d3_geo_projectGeometry(geometry, stream);
    })
  };

  if (!d3_geo_projectGeometryType.hasOwnProperty(geometry.type)) return null;
  var sink = d3_geo_projectGeometryType[geometry.type];
  d3.geo.stream(geometry, stream(sink));
  return sink.result();
}

var d3_geo_projectObjectType = {
  Feature: d3_geo_projectFeature,
  FeatureCollection: function(object, stream) {
    return {
      type: "FeatureCollection",
      features: object.features.map(function(feature) {
        return d3_geo_projectFeature(feature, stream);
      })
    };
  }
};

var d3_geo_projectPoints = [],
    d3_geo_projectLines = [];

var d3_geo_projectPoint = {
  point: function(x, y) {
    d3_geo_projectPoints.push([x, y]);
  },
  result: function() {
    var result = !d3_geo_projectPoints.length ? null
        : d3_geo_projectPoints.length < 2 ? {type: "Point", coordinates: d3_geo_projectPoints[0]}
        : {type: "MultiPoint", coordinates: d3_geo_projectPoints};
    d3_geo_projectPoints = [];
    return result;
  }
};

var d3_geo_projectLine = {
  lineStart: d3_geo_projectNoop,
  point: function(x, y) {
    d3_geo_projectPoints.push([x, y]);
  },
  lineEnd: function() {
    if (d3_geo_projectPoints.length) d3_geo_projectLines.push(d3_geo_projectPoints), d3_geo_projectPoints = [];
  },
  result: function() {
    var result = !d3_geo_projectLines.length ? null
        : d3_geo_projectLines.length < 2 ? {type: "LineString", coordinates: d3_geo_projectLines[0]}
        : {type: "MultiLineString", coordinates: d3_geo_projectLines};
    d3_geo_projectLines = [];
    return result;
  }
};

var d3_geo_projectPolygon = {
  polygonStart: d3_geo_projectNoop,
  lineStart: d3_geo_projectNoop,
  point: function(x, y) {
    d3_geo_projectPoints.push([x, y]);
  },
  lineEnd: function() {
    var n = d3_geo_projectPoints.length;
    if (n) {
      do d3_geo_projectPoints.push(d3_geo_projectPoints[0].slice()); while (++n < 4);
      d3_geo_projectLines.push(d3_geo_projectPoints), d3_geo_projectPoints = [];
    }
  },
  polygonEnd: d3_geo_projectNoop,
  result: function() {
    if (!d3_geo_projectLines.length) return null;
    var polygons = [],
        holes = [];

    // https://github.com/mbostock/d3/issues/1558

    d3_geo_projectLines.forEach(function(ring) {
      if (d3_geo_projectClockwise(ring)) polygons.push([ring]);
      else holes.push(ring);
    });

    holes.forEach(function(hole) {
      var point = hole[0];
      polygons.some(function(polygon) {
        if (d3_geo_projectContains(polygon[0], point)) {
          polygon.push(hole);
          return true;
        }
      }) || polygons.push([hole]);
    });

    d3_geo_projectLines = [];

    return !polygons.length ? null
        : polygons.length > 1 ? {type: "MultiPolygon", coordinates: polygons}
        : {type: "Polygon", coordinates: polygons[0]};
  }
};

var d3_geo_projectGeometryType = {
  Point: d3_geo_projectPoint,
  MultiPoint: d3_geo_projectPoint,
  LineString: d3_geo_projectLine,
  MultiLineString: d3_geo_projectLine,
  Polygon: d3_geo_projectPolygon,
  MultiPolygon: d3_geo_projectPolygon,
  Sphere: d3_geo_projectPolygon
};

function d3_geo_projectNoop() {}

function d3_geo_projectClockwise(ring) {
  if ((n = ring.length) < 4) return false;
  var i = 0,
      n,
      area = ring[n - 1][1] * ring[0][0] - ring[n - 1][0] * ring[0][1];
  while (++i < n) area += ring[i - 1][1] * ring[i][0] - ring[i - 1][0] * ring[i][1];
  return area <= 0;
}

function d3_geo_projectContains(ring, point) {
  var x = point[0],
      y = point[1],
      contains = false;
  for (var i = 0, n = ring.length, j = n - 1; i < n; j = i++) {
    var pi = ring[i], xi = pi[0], yi = pi[1],
        pj = ring[j], xj = pj[0], yj = pj[1];
    if (((yi > y) ^ (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) contains = !contains;
  }
  return contains;
}
