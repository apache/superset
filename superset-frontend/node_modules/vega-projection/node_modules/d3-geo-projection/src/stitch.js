var epsilon = 1e-4,
    epsilonInverse = 1e4,
    x0 = -180, x0e = x0 + epsilon,
    x1 = 180, x1e = x1 - epsilon,
    y0 = -90, y0e = y0 + epsilon,
    y1 = 90, y1e = y1 - epsilon;

function nonempty(coordinates) {
  return coordinates.length > 0;
}

function quantize(x) {
  return Math.floor(x * epsilonInverse) / epsilonInverse;
}

function normalizePoint(y) {
  return y === y0 || y === y1 ? [0, y] : [x0, quantize(y)]; // pole or antimeridian?
}

function clampPoint(p) {
  var x = p[0], y = p[1], clamped = false;
  if (x <= x0e) x = x0, clamped = true;
  else if (x >= x1e) x = x1, clamped = true;
  if (y <= y0e) y = y0, clamped = true;
  else if (y >= y1e) y = y1, clamped = true;
  return clamped ? [x, y] : p;
}

function clampPoints(points) {
  return points.map(clampPoint);
}

// For each ring, detect where it crosses the antimeridian or pole.
function extractFragments(rings, polygon, fragments) {
  for (var j = 0, m = rings.length; j < m; ++j) {
    var ring = rings[j].slice();

    // By default, assume that this ring doesn’t need any stitching.
    fragments.push({index: -1, polygon: polygon, ring: ring});

    for (var i = 0, n = ring.length; i < n; ++i) {
      var point = ring[i],
          x = point[0],
          y = point[1];

      // If this is an antimeridian or polar point…
      if (x <= x0e || x >= x1e || y <= y0e || y >= y1e) {
        ring[i] = clampPoint(point);

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
          var fragmentBefore = {index: -1, polygon: polygon, ring: ring.slice(0, i + 1)};
          fragmentBefore.ring[fragmentBefore.ring.length - 1] = normalizePoint(y);
          fragments[fragments.length - 1] = fragmentBefore;
        }

        // If the ring started with an antimeridian fragment,
        // we can ignore that fragment entirely.
        else fragments.pop();

        // If the remainder of the ring is an antimeridian fragment,
        // move on to the next ring.
        if (k >= n) break;

        // Otherwise, add the remaining ring fragment and continue.
        fragments.push({index: -1, polygon: polygon, ring: ring = ring.slice(k - 1)});
        ring[0] = normalizePoint(ring[0][1]);
        i = -1;
        n = ring.length;
      }
    }
  }
}

// Now stitch the fragments back together into rings.
function stitchFragments(fragments) {
  var i, n = fragments.length;

  // To connect the fragments start-to-end, create a simple index by end.
  var fragmentByStart = {},
      fragmentByEnd = {},
      fragment,
      start,
      startFragment,
      end,
      endFragment;

  // For each fragment…
  for (i = 0; i < n; ++i) {
    fragment = fragments[i];
    start = fragment.ring[0];
    end = fragment.ring[fragment.ring.length - 1];

    // If this fragment is closed, add it as a standalone ring.
    if (start[0] === end[0] && start[1] === end[1]) {
      fragment.polygon.push(fragment.ring);
      fragments[i] = null;
      continue;
    }

    fragment.index = i;
    fragmentByStart[start] = fragmentByEnd[end] = fragment;
  }

  // For each open fragment…
  for (i = 0; i < n; ++i) {
    fragment = fragments[i];
    if (fragment) {
      start = fragment.ring[0];
      end = fragment.ring[fragment.ring.length - 1];
      startFragment = fragmentByEnd[start];
      endFragment = fragmentByStart[end];

      delete fragmentByStart[start];
      delete fragmentByEnd[end];

      // If this fragment is closed, add it as a standalone ring.
      if (start[0] === end[0] && start[1] === end[1]) {
        fragment.polygon.push(fragment.ring);
        continue;
      }

      if (startFragment) {
        delete fragmentByEnd[start];
        delete fragmentByStart[startFragment.ring[0]];
        startFragment.ring.pop(); // drop the shared coordinate
        fragments[startFragment.index] = null;
        fragment = {index: -1, polygon: startFragment.polygon, ring: startFragment.ring.concat(fragment.ring)};

        if (startFragment === endFragment) {
          // Connect both ends to this single fragment to create a ring.
          fragment.polygon.push(fragment.ring);
        } else {
          fragment.index = n++;
          fragments.push(fragmentByStart[fragment.ring[0]] = fragmentByEnd[fragment.ring[fragment.ring.length - 1]] = fragment);
        }
      } else if (endFragment) {
        delete fragmentByStart[end];
        delete fragmentByEnd[endFragment.ring[endFragment.ring.length - 1]];
        fragment.ring.pop(); // drop the shared coordinate
        fragment = {index: n++, polygon: endFragment.polygon, ring: fragment.ring.concat(endFragment.ring)};
        fragments[endFragment.index] = null;
        fragments.push(fragmentByStart[fragment.ring[0]] = fragmentByEnd[fragment.ring[fragment.ring.length - 1]] = fragment);
      } else {
        fragment.ring.push(fragment.ring[0]); // close ring
        fragment.polygon.push(fragment.ring);
      }
    }
  }
}

function stitchFeature(input) {
  var output = {type: "Feature", geometry: stitchGeometry(input.geometry)};
  if (input.id != null) output.id = input.id;
  if (input.bbox != null) output.bbox = input.bbox;
  if (input.properties != null) output.properties = input.properties;
  return output;
}

function stitchGeometry(input) {
  if (input == null) return input;
  var output, fragments, i, n;
  switch (input.type) {
    case "GeometryCollection": output = {type: "GeometryCollection", geometries: input.geometries.map(stitchGeometry)}; break;
    case "Point": output = {type: "Point", coordinates: clampPoint(input.coordinates)}; break;
    case "MultiPoint": case "LineString": output = {type: input.type, coordinates: clampPoints(input.coordinates)}; break;
    case "MultiLineString": output = {type: "MultiLineString", coordinates: input.coordinates.map(clampPoints)}; break;
    case "Polygon": {
      var polygon = [];
      extractFragments(input.coordinates, polygon, fragments = []);
      stitchFragments(fragments);
      output = {type: "Polygon", coordinates: polygon};
      break;
    }
    case "MultiPolygon": {
      fragments = [], i = -1, n = input.coordinates.length;
      var polygons = new Array(n);
      while (++i < n) extractFragments(input.coordinates[i], polygons[i] = [], fragments);
      stitchFragments(fragments);
      output = {type: "MultiPolygon", coordinates: polygons.filter(nonempty)};
      break;
    }
    default: return input;
  }
  if (input.bbox != null) output.bbox = input.bbox;
  return output;
}

export default function(input) {
  if (input == null) return input;
  switch (input.type) {
    case "Feature": return stitchFeature(input);
    case "FeatureCollection": {
      var output = {type: "FeatureCollection", features: input.features.map(stitchFeature)};
      if (input.bbox != null) output.bbox = input.bbox;
      return output;
    }
    default: return stitchGeometry(input);
  }
}
