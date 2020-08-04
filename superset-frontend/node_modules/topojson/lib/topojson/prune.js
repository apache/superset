module.exports = function(topology, options) {
  var verbose = false,
      objects = topology.objects,
      oldArcs = topology.arcs,
      oldArcCount = oldArcs.length,
      newArcs = topology.arcs = [],
      newArcCount = 0,
      newIndexByOldIndex = new Array(oldArcs.length);

  if (options)
    "verbose" in options && (verbose = !!options["verbose"]);

  function pruneGeometry(geometry) {
    if (geometry && pruneGeometryType.hasOwnProperty(geometry.type)) pruneGeometryType[geometry.type](geometry);
  }

  var pruneGeometryType = {
    GeometryCollection: function(o) { o.geometries.forEach(pruneGeometry); },
    LineString: function(o) { pruneArcs(o.arcs); },
    MultiLineString: function(o) { o.arcs.forEach(pruneArcs); },
    Polygon: function(o) { o.arcs.forEach(pruneArcs); },
    MultiPolygon: function(o) { o.arcs.forEach(pruneMultiArcs); }
  };

  function pruneArcs(arcs) {
    for (var i = 0, n = arcs.length; i < n; ++i) {
      var oldIndex = arcs[i],
          oldReverse = oldIndex < 0 && (oldIndex = ~oldIndex, true),
          newIndex;

      // If this is the first instance of this arc,
      // record it under its new index.
      if ((newIndex = newIndexByOldIndex[oldIndex]) == null) {
        newIndexByOldIndex[oldIndex] = newIndex = newArcCount++;
        newArcs[newIndex] = oldArcs[oldIndex];
      }

      arcs[i] = oldReverse ? ~newIndex : newIndex;
    }
  }

  function pruneMultiArcs(arcs) {
    arcs.forEach(pruneArcs);
  }

  for (var key in objects) {
    pruneGeometry(objects[key]);
  }

  if (verbose) process.stderr.write("prune: retained " + newArcCount + " / " + oldArcCount + " arcs (" + Math.round(newArcCount / oldArcCount * 100) + "%)\n");

  return topology;
};

function noop() {}
