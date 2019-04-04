topojson = (function() {

  function merge(topology, arcs) {
    var arcsByEnd = {},
        fragmentByStart = {},
        fragmentByEnd = {};

    arcs.forEach(function(i) {
      var e = ends(i);
      (arcsByEnd[e[0]] || (arcsByEnd[e[0]] = [])).push(i);
      (arcsByEnd[e[1]] || (arcsByEnd[e[1]] = [])).push(~i);
    });

    arcs.forEach(function(i) {
      var e = ends(i),
          start = e[0],
          end = e[1],
          f, g;

      if (f = fragmentByEnd[start]) {
        delete fragmentByEnd[f.end];
        f.push(i);
        f.end = end;
        if (g = fragmentByStart[end]) {
          delete fragmentByStart[g.start];
          var fg = g === f ? f : f.concat(g);
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.end] = fg;
        } else if (g = fragmentByEnd[end]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var fg = f.concat(g.map(function(i) { return ~i; }).reverse());
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.start] = fg;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else if (f = fragmentByStart[end]) {
        delete fragmentByStart[f.start];
        f.unshift(i);
        f.start = start;
        if (g = fragmentByEnd[start]) {
          delete fragmentByEnd[g.end];
          var gf = g === f ? f : g.concat(f);
          fragmentByStart[gf.start = g.start] = fragmentByEnd[gf.end = f.end] = gf;
        } else if (g = fragmentByStart[start]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var gf = g.map(function(i) { return ~i; }).reverse().concat(f);
          fragmentByStart[gf.start = g.end] = fragmentByEnd[gf.end = f.end] = gf;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else if (f = fragmentByStart[start]) {
        delete fragmentByStart[f.start];
        f.unshift(~i);
        f.start = end;
        if (g = fragmentByEnd[end]) {
          delete fragmentByEnd[g.end];
          var gf = g === f ? f : g.concat(f);
          fragmentByStart[gf.start = g.start] = fragmentByEnd[gf.end = f.end] = gf;
        } else if (g = fragmentByStart[end]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var gf = g.map(function(i) { return ~i; }).reverse().concat(f);
          fragmentByStart[gf.start = g.end] = fragmentByEnd[gf.end = f.end] = gf;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else if (f = fragmentByEnd[end]) {
        delete fragmentByEnd[f.end];
        f.push(~i);
        f.end = start;
        if (g = fragmentByEnd[start]) {
          delete fragmentByStart[g.start];
          var fg = g === f ? f : f.concat(g);
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.end] = fg;
        } else if (g = fragmentByStart[start]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var fg = f.concat(g.map(function(i) { return ~i; }).reverse());
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.start] = fg;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else {
        f = [i];
        fragmentByStart[f.start = start] = fragmentByEnd[f.end = end] = f;
      }
    });

    function ends(i) {
      var arc = topology.arcs[i], p0 = arc[0], p1 = [0, 0];
      arc.forEach(function(dp) { p1[0] += dp[0], p1[1] += dp[1]; });
      return [p0, p1];
    }

    var fragments = [];
    for (var k in fragmentByEnd) fragments.push(fragmentByEnd[k]);
    return fragments;
  }

  function mesh(topology, o, filter) {
    var arcs = [];

    if (arguments.length > 1) {
      var geomsByArc = [],
          geom;

      function arc(i) {
        if (i < 0) i = ~i;
        (geomsByArc[i] || (geomsByArc[i] = [])).push(geom);
      }

      function line(arcs) {
        arcs.forEach(arc);
      }

      function polygon(arcs) {
        arcs.forEach(line);
      }

      function geometry(o) {
        if (o.type === "GeometryCollection") o.geometries.forEach(geometry);
        else if (o.type in geometryType) {
          geom = o;
          geometryType[o.type](o.arcs);
        }
      }

      var geometryType = {
        LineString: line,
        MultiLineString: polygon,
        Polygon: polygon,
        MultiPolygon: function(arcs) { arcs.forEach(polygon); }
      };

      geometry(o);

      geomsByArc.forEach(arguments.length < 3
          ? function(geoms, i) { arcs.push(i); }
          : function(geoms, i) { if (filter(geoms[0], geoms[geoms.length - 1])) arcs.push(i); });
    } else {
      for (var i = 0, n = topology.arcs.length; i < n; ++i) arcs.push(i);
    }

    return object(topology, {type: "MultiLineString", arcs: merge(topology, arcs)});
  }

  function featureOrCollection(topology, o) {
    return o.type === "GeometryCollection" ? {
      type: "FeatureCollection",
      features: o.geometries.map(function(o) { return feature(topology, o); })
    } : feature(topology, o);
  }

  function feature(topology, o) {
    var f = {
      type: "Feature",
      id: o.id,
      properties: o.properties || {},
      geometry: object(topology, o)
    };
    if (o.id == null) delete f.id;
    return f;
  }

  function object(topology, o) {
    var tf = topology.transform,
        kx = tf.scale[0],
        ky = tf.scale[1],
        dx = tf.translate[0],
        dy = tf.translate[1],
        arcs = topology.arcs;

    function arc(i, points) {
      if (points.length) points.pop();
      for (var a = arcs[i < 0 ? ~i : i], k = 0, n = a.length, x = 0, y = 0, p; k < n; ++k) points.push([
        (x += (p = a[k])[0]) * kx + dx,
        (y += p[1]) * ky + dy
      ]);
      if (i < 0) reverse(points, n);
    }

    function point(coordinates) {
      return [coordinates[0] * kx + dx, coordinates[1] * ky + dy];
    }

    function line(arcs) {
      var points = [];
      for (var i = 0, n = arcs.length; i < n; ++i) arc(arcs[i], points);
      if (points.length < 2) points.push(points[0]);
      return points;
    }

    function ring(arcs) {
      var points = line(arcs);
      while (points.length < 4) points.push(points[0]);
      return points;
    }

    function polygon(arcs) {
      return arcs.map(ring);
    }

    function geometry(o) {
      var t = o.type;
      return t === "GeometryCollection" ? {type: t, geometries: o.geometries.map(geometry)}
          : t in geometryType ? {type: t, coordinates: geometryType[t](o)}
          : null;
    }

    var geometryType = {
      Point: function(o) { return point(o.coordinates); },
      MultiPoint: function(o) { return o.coordinates.map(point); },
      LineString: function(o) { return line(o.arcs); },
      MultiLineString: function(o) { return o.arcs.map(line); },
      Polygon: function(o) { return polygon(o.arcs); },
      MultiPolygon: function(o) { return o.arcs.map(polygon); }
    };

    return geometry(o);
  }

  function reverse(array, n) {
    var t, j = array.length, i = j - n; while (i < --j) t = array[i], array[i++] = array[j], array[j] = t;
  }

  function bisect(a, x) {
    var lo = 0, hi = a.length;
    while (lo < hi) {
      var mid = lo + hi >>> 1;
      if (a[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function neighbors(objects) {
    var objectsByArc = [],
        neighbors = objects.map(function() { return []; });

    function line(arcs, i) {
      arcs.forEach(function(a) {
        if (a < 0) a = ~a;
        var o = objectsByArc[a] || (objectsByArc[a] = []);
        if (!o[i]) o.forEach(function(j) {
          var n, k;
          k = bisect(n = neighbors[i], j); if (n[k] !== j) n.splice(k, 0, j);
          k = bisect(n = neighbors[j], i); if (n[k] !== i) n.splice(k, 0, i);
        }), o[i] = i;
      });
    }

    function polygon(arcs, i) {
      arcs.forEach(function(arc) { line(arc, i); });
    }

    function geometry(o, i) {
      if (o.type === "GeometryCollection") o.geometries.forEach(function(o) { geometry(o, i); });
      else if (o.type in geometryType) geometryType[o.type](o.arcs, i);
    }

    var geometryType = {
      LineString: line,
      MultiLineString: polygon,
      Polygon: polygon,
      MultiPolygon: function(arcs, i) { arcs.forEach(function(arc) { polygon(arc, i); }); }
    };

    objects.forEach(geometry);
    return neighbors;
  }

  return {
    version: "1.1.3",
    mesh: mesh,
    feature: featureOrCollection,
    neighbors: neighbors
  };
})();
