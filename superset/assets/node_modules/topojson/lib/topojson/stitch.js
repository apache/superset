var type = require("./type");

module.exports = function(objects, transform) {
  var ε = 1e-2,
      x0 = -180, x0e = x0 + ε,
      x1 = 180, x1e = x1 - ε,
      y0 = -90, y0e = y0 + ε,
      y1 = 90, y1e = y1 - ε;

  if (transform) {
    var kx = transform.scale[0],
        ky = transform.scale[1],
        dx = transform.translate[0],
        dy = transform.translate[1];

    x0 = Math.round((x0 - dx) / kx);
    x1 = Math.round((x1 - dx) / kx);
    y0 = Math.round((y0 - dy) / ky);
    y1 = Math.round((y1 - dy) / ky);
    x0e = Math.round((x0e - dx) / kx);
    x1e = Math.round((x1e - dx) / kx);
    y0e = Math.round((y0e - dy) / ky);
    y1e = Math.round((y1e - dy) / ky);
  }

  function normalizePoint(y) {
    return y <= y0e ? [0, y0] // south pole
        : y >= y1e ? [0, y1] // north pole
        : [x0, y]; // antimeridian
  }

  function stitchPolygons(polygons) {
    var fragments = [];

    for (var p = 0, np = polygons.length; p < np; ++p) {
      var polygon = polygons[p];

      // For each ring, detect where it crosses the antimeridian or pole.
      for (var j = 0, m = polygon.length; j < m; ++j) {
        var ring = polygon[j];
        ring.polygon = polygon;

        // By default, assume that this ring doesn’t need any stitching.
        fragments.push(ring);

        for (var i = 0, n = ring.length; i < n; ++i) {
          var point = ring[i],
              x = point[0],
              y = point[1];

          // If this is an antimeridian or polar point…
          if (x <= x0e || x >= x1e || y <= y0e || y >= y1e) {

            // Advance through any antimeridian or polar points…
            for (var k = i + 1; k < n; ++k) {
              var pointk = ring[k],
                  xk = pointk[0],
                  yk = pointk[1];
              if (xk > x0e && xk < x1e && yk > y0e && yk < y1e) break;
            }

            // If this was just a single antimeridian or polar point,
            // we don’t need to cut this ring into a fragment;
            // we can just leave it as-is.
            if (k === i + 1) continue;

            // Otherwise, if this is not the first point in the ring,
            // cut the current fragment so that it ends at the current point.
            // The current point is also normalized for later joining.
            if (i) {
              var fragmentBefore = ring.slice(0, i + 1);
              fragmentBefore.polygon = polygon;
              fragmentBefore[fragmentBefore.length - 1] = normalizePoint(y);
              fragments[fragments.length - 1] = fragmentBefore;
            }

            // If the ring started with an antimeridian fragment,
            // we can ignore that fragment entirely.
            else {
              fragments.pop();
            }

            // If the remainder of the ring is an antimeridian fragment,
            // move on to the next ring.
            if (k >= n) break;

            // Otherwise, add the remaining ring fragment and continue.
            fragments.push(ring = ring.slice(k - 1));
            ring[0] = normalizePoint(ring[0][1]);
            ring.polygon = polygon;
            i = -1;
            n = ring.length;
          }
        }
      }
      polygon.length = 0;
    }

    // Now stitch the fragments back together into rings.
    // To connect the fragments start-to-end, create a simple index by end.
    var fragmentByStart = {},
        fragmentByEnd = {};

    // For each fragment…
    for (var i = 0, n = fragments.length; i < n; ++i) {
      var fragment = fragments[i],
          start = fragment[0],
          end = fragment[fragment.length - 1];

      // If this fragment is closed, add it as a standalone ring.
      if (start[0] === end[0] && start[1] === end[1]) {
        fragment.polygon.push(fragment);
        fragments[i] = null;
        continue;
      }

      fragment.index = i;
      fragmentByStart[start] = fragmentByEnd[end] = fragment;
    }

    // For each open fragment…
    for (var i = 0; i < n; ++i) {
      var fragment = fragments[i];
      if (fragment) {

        var start = fragment[0],
            end = fragment[fragment.length - 1],
            startFragment = fragmentByEnd[start],
            endFragment = fragmentByStart[end];

        delete fragmentByStart[start];
        delete fragmentByEnd[end];

        // If this fragment is closed, add it as a standalone ring.
        if (start[0] === end[0] && start[1] === end[1]) {
          fragment.polygon.push(fragment);
          continue;
        }

        if (startFragment) {
          delete fragmentByEnd[start];
          delete fragmentByStart[startFragment[0]];
          startFragment.pop(); // drop the shared coordinate
          fragments[startFragment.index] = null;
          fragment = startFragment.concat(fragment);
          fragment.polygon = startFragment.polygon;

          if (startFragment === endFragment) {
            // Connect both ends to this single fragment to create a ring.
            fragment.polygon.push(fragment);
          } else {
            fragment.index = n++;
            fragments.push(fragmentByStart[fragment[0]] = fragmentByEnd[fragment[fragment.length - 1]] = fragment);
          }
        } else if (endFragment) {
          delete fragmentByStart[end];
          delete fragmentByEnd[endFragment[endFragment.length - 1]];
          fragment.pop(); // drop the shared coordinate
          fragment = fragment.concat(endFragment);
          fragment.polygon = endFragment.polygon;
          fragment.index = n++;
          fragments[endFragment.index] = null;
          fragments.push(fragmentByStart[fragment[0]] = fragmentByEnd[fragment[fragment.length - 1]] = fragment);
        } else {
          fragment.push(fragment[0]); // close ring
          fragment.polygon.push(fragment);
        }
      }
    }
    // TODO remove empty polygons.
  }

  var stitch = type({
    Polygon: function(polygon) { stitchPolygons([polygon.coordinates]); },
    MultiPolygon: function(multiPolygon) { stitchPolygons(multiPolygon.coordinates); }
  });

  for (var key in objects) {
    stitch.object(objects[key]);
  }
};
