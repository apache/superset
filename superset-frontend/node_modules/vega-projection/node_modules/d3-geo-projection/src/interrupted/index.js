import {merge} from "d3-array";
import {geoStream, geoProjection as projection} from "d3-geo";
import {abs, degrees, epsilon, radians} from "../math.js";

function pointEqual(a, b) {
  return abs(a[0] - b[0]) < epsilon && abs(a[1] - b[1]) < epsilon;
}

function interpolateLine(coordinates, m) {
  var i = -1,
      n = coordinates.length,
      p0 = coordinates[0],
      p1,
      dx,
      dy,
      resampled = [];
  while (++i < n) {
    p1 = coordinates[i];
    dx = (p1[0] - p0[0]) / m;
    dy = (p1[1] - p0[1]) / m;
    for (var j = 0; j < m; ++j) resampled.push([p0[0] + j * dx, p0[1] + j * dy]);
    p0 = p1;
  }
  resampled.push(p1);
  return resampled;
}

function interpolateSphere(lobes) {
  var coordinates = [],
      lobe,
      lambda0, phi0, phi1,
      lambda2, phi2,
      i, n = lobes[0].length;

  // Northern Hemisphere
  for (i = 0; i < n; ++i) {
    lobe = lobes[0][i];
    lambda0 = lobe[0][0], phi0 = lobe[0][1], phi1 = lobe[1][1];
    lambda2 = lobe[2][0], phi2 = lobe[2][1];
    coordinates.push(interpolateLine([
      [lambda0 + epsilon, phi0 + epsilon],
      [lambda0 + epsilon, phi1 - epsilon],
      [lambda2 - epsilon, phi1 - epsilon],
      [lambda2 - epsilon, phi2 + epsilon]
    ], 30));
  }

  // Southern Hemisphere
  for (i = lobes[1].length - 1; i >= 0; --i) {
    lobe = lobes[1][i];
    lambda0 = lobe[0][0], phi0 = lobe[0][1], phi1 = lobe[1][1];
    lambda2 = lobe[2][0], phi2 = lobe[2][1];
    coordinates.push(interpolateLine([
      [lambda2 - epsilon, phi2 - epsilon],
      [lambda2 - epsilon, phi1 + epsilon],
      [lambda0 + epsilon, phi1 + epsilon],
      [lambda0 + epsilon, phi0 - epsilon]
    ], 30));
  }

  return {
    type: "Polygon",
    coordinates: [merge(coordinates)]
  };
}

export default function(project, lobes, inverse) {
  var sphere, bounds;

  function forward(lambda, phi) {
    var sign = phi < 0 ? -1 : +1, lobe = lobes[+(phi < 0)];
    for (var i = 0, n = lobe.length - 1; i < n && lambda > lobe[i][2][0]; ++i);
    var p = project(lambda - lobe[i][1][0], phi);
    p[0] += project(lobe[i][1][0], sign * phi > sign * lobe[i][0][1] ? lobe[i][0][1] : phi)[0];
    return p;
  }

  if (inverse) {
    forward.invert = inverse(forward);
  } else if (project.invert) {
    forward.invert = function(x, y) {
      var bound = bounds[+(y < 0)], lobe = lobes[+(y < 0)];
      for (var i = 0, n = bound.length; i < n; ++i) {
        var b = bound[i];
        if (b[0][0] <= x && x < b[1][0] && b[0][1] <= y && y < b[1][1]) {
          var p = project.invert(x - project(lobe[i][1][0], 0)[0], y);
          p[0] += lobe[i][1][0];
          return pointEqual(forward(p[0], p[1]), [x, y]) ? p : null;
        }
      }
    };
  }

  var p = projection(forward),
      stream_ = p.stream;

  p.stream = function(stream) {
    var rotate = p.rotate(),
        rotateStream = stream_(stream),
        sphereStream = (p.rotate([0, 0]), stream_(stream));
    p.rotate(rotate);
    rotateStream.sphere = function() { geoStream(sphere, sphereStream); };
    return rotateStream;
  };
  
  p.lobes = function(_) {
    if (!arguments.length) return lobes.map(function(lobe) {
      return lobe.map(function(l) {
        return [
          [l[0][0] * degrees, l[0][1] * degrees],
          [l[1][0] * degrees, l[1][1] * degrees],
          [l[2][0] * degrees, l[2][1] * degrees]
        ];
      });
    });

    sphere = interpolateSphere(_);

    lobes = _.map(function(lobe) {
      return lobe.map(function(l) {
        return [
          [l[0][0] * radians, l[0][1] * radians],
          [l[1][0] * radians, l[1][1] * radians],
          [l[2][0] * radians, l[2][1] * radians]
        ];
      });
    });

    bounds = lobes.map(function(lobe) {
      return lobe.map(function(l) {
        var x0 = project(l[0][0], l[0][1])[0],
            x1 = project(l[2][0], l[2][1])[0],
            y0 = project(l[1][0], l[0][1])[1],
            y1 = project(l[1][0], l[1][1])[1],
            t;
        if (y0 > y1) t = y0, y0 = y1, y1 = t;
        return [[x0, y0], [x1, y1]];
      });
    });

    return p;
  };

  if (lobes != null) p.lobes(lobes);

  return p;
}
