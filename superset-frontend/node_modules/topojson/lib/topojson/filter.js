var type = require("./type"),
    prune = require("./prune"),
    clockwise = require("./clockwise"),
    systems = require("./coordinate-systems"),
    topojson = require("../../build/topojson");

module.exports = function(topology, options) {
  var system = null,
      forceClockwise = true, // force exterior rings to be clockwise?
      preserveAttached = true, // e.g., remove islands but not small counties
      preserveRing = preserveNone,
      minimumArea;

  if (options)
    "coordinate-system" in options && (system = systems[options["coordinate-system"]]),
    "minimum-area" in options && (minimumArea = +options["minimum-area"]),
    "preserve-attached" in options && (preserveAttached = !!options["preserve-attached"]),
    "force-clockwise" in options && (forceClockwise = !!options["force-clockwise"]);

  if (forceClockwise) clockwise(topology, options); // deprecated; for backwards-compatibility

  if (!(minimumArea > 0)) minimumArea = Number.MIN_VALUE;

  if (preserveAttached) {
    var uniqueRingByArc = {}, // arc index -> index of unique associated ring, or -1 if used by multiple rings
        ringIndex = 0;

    var checkAttachment = type({
      LineString: noop,
      MultiLineString: noop,
      Point: noop,
      MultiPoint: noop,
      MultiPolygon: function(multiPolygon) {
        var arcs = multiPolygon.arcs, i = -1, n = arcs.length;
        while (++i < n) this.polygon(arcs[i]);
      },
      Polygon: function(polygon) {
        this.polygon(polygon.arcs);
      },
      polygon: function(arcs) {
        for (var i = 0, n = arcs.length; i < n; ++i, ++ringIndex) {
          for (var ring = arcs[i], j = 0, m = ring.length; j < m; ++j) {
            var arc = ring[j];
            if (arc < 0) arc = ~arc;
            var uniqueRing = uniqueRingByArc[arc];
            if (uniqueRing >= 0 && uniqueRing !== ringIndex) uniqueRingByArc[arc] = -1;
            else uniqueRingByArc[arc] = ringIndex;
          }
        }
      }
    });

    preserveRing = function(ring) {
      for (var j = 0, m = ring.length; j < m; ++j) {
        var arc = ring[j];
        if (uniqueRingByArc[arc < 0 ? ~arc : arc] < 0) {
          return true;
        }
      }
    };

    for (var key in topology.objects) {
      checkAttachment.object(topology.objects[key]);
    }
  }

  var filter = type({
    LineString: noop, // TODO remove empty lines
    MultiLineString: noop,
    Point: noop,
    MultiPoint: noop,
    Polygon: function(polygon) {
      polygon.arcs = filterPolygon(polygon.arcs);
      if (!polygon.arcs || !polygon.arcs.length) {
        polygon.type = null;
        delete polygon.arcs;
      }
    },
    MultiPolygon: function(multiPolygon) {
      multiPolygon.arcs = multiPolygon.arcs
          .map(filterPolygon)
          .filter(function(polygon) { return polygon && polygon.length; });
      if (!multiPolygon.arcs.length) {
        multiPolygon.type = null;
        delete multiPolygon.arcs;
      }
    },
    GeometryCollection: function(collection) {
      this.defaults.GeometryCollection.call(this, collection);
      collection.geometries = collection.geometries.filter(function(geometry) { return geometry.type != null; });
      if (!collection.geometries.length) {
        collection.type = null;
        delete collection.geometries;
      }
    }
  });

  for (var key in topology.objects) {
    filter.object(topology.objects[key]);
  }

  prune(topology, options);

  function filterPolygon(arcs) {
    return arcs.length && filterExteriorRing(arcs[0]) // if the exterior is small, ignore any holes
        ? [arcs.shift()].concat(arcs.filter(filterInteriorRing))
        : null;
  }

  function filterExteriorRing(ring) {
    return preserveRing(ring) || system.absoluteArea(ringArea(ring)) >= minimumArea;
  }

  function filterInteriorRing(ring) {
    return preserveRing(ring) || system.absoluteArea(-ringArea(ring)) >= minimumArea;
  }

  function ringArea(ring) {
    return system.ringArea(topojson.feature(topology, {type: "Polygon", arcs: [ring]}).geometry.coordinates[0]);
  }
};

function noop() {}

function preserveNone() {
  return false;
}
