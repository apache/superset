// Given a hash of GeoJSON objects, replaces Features with geometry objects.
// This is a destructive operation that modifies the input objects!
module.exports = function(objects) {

  function geomifyObject(object) {
    return (object && geomifyObjectType.hasOwnProperty(object.type)
        ? geomifyObjectType[object.type]
        : geomifyGeometry)(object);
  }

  function geomifyFeature(feature) {
    var geometry = feature.geometry;
    if (geometry == null) {
      feature.type = null;
    } else {
      geomifyGeometry(geometry);
      feature.type = geometry.type;
      if (geometry.geometries) feature.geometries = geometry.geometries;
      else if (geometry.coordinates) feature.coordinates = geometry.coordinates;
    }
    delete feature.geometry;
    return feature;
  }

  function geomifyGeometry(geometry) {
    if (!geometry) return {type: null};
    if (geomifyGeometryType.hasOwnProperty(geometry.type)) geomifyGeometryType[geometry.type](geometry);
    return geometry;
  }

  var geomifyObjectType = {
    Feature: geomifyFeature,
    FeatureCollection: function(collection) {
      collection.type = "GeometryCollection";
      collection.geometries = collection.features;
      collection.features.forEach(geomifyFeature);
      delete collection.features;
      return collection;
    }
  };

  var geomifyGeometryType = {
    GeometryCollection: function(o) {
      var geometries = o.geometries, i = -1, n = geometries.length;
      while (++i < n) geometries[i] = geomifyGeometry(geometries[i]);
    },
    MultiPoint: function(o) {
      if (!o.coordinates.length) {
        o.type = null;
        delete o.coordinates;
      } else if (o.coordinates.length < 2) {
        o.type = "Point";
        o.coordinates = o.coordinates[0];
      }
    },
    LineString: function(o) {
      if (!o.coordinates.length) {
        o.type = null;
        delete o.coordinates;
      }
    },
    MultiLineString: function(o) {
      for (var lines = o.coordinates, i = 0, N = 0, n = lines.length; i < n; ++i) {
        var line = lines[i];
        if (line.length) lines[N++] = line;
      }
      if (!N) {
        o.type = null;
        delete o.coordinates;
      } else if (N < 2) {
        o.type = "LineString";
        o.coordinates = lines[0];
      } else {
        o.coordinates.length = N;
      }
    },
    Polygon: function(o) {
      for (var rings = o.coordinates, i = 0, N = 0, n = rings.length; i < n; ++i) {
        var ring = rings[i];
        if (ring.length) rings[N++] = ring;
      }
      if (!N) {
        o.type = null;
        delete o.coordinates;
      } else {
        o.coordinates.length = N;
      }
    },
    MultiPolygon: function(o) {
      for (var polygons = o.coordinates, j = 0, M = 0, m = polygons.length; j < m; ++j) {
        for (var rings = polygons[j], i = 0, N = 0, n = rings.length; i < n; ++i) {
          var ring = rings[i];
          if (ring.length) rings[N++] = ring;
        }
        if (N) {
          rings.length = N;
          polygons[M++] = rings;
        }
      }
      if (!M) {
        o.type = null;
        delete o.coordinates;
      } else if (M < 2) {
        o.type = "Polygon";
        o.coordinates = polygons[0];
      } else {
        polygons.length = M;
      }
    }
  };

  for (var key in objects) {
    objects[key] = geomifyObject(objects[key]);
  }

  return objects;
};
