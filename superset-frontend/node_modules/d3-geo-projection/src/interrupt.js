import "projection";
import "math";

d3.geo.interrupt = function(project) {
  var lobes = [
    [[[-π, 0], [0,  halfπ], [π, 0]]],
    [[[-π, 0], [0, -halfπ], [π, 0]]]
  ];

  var bounds;

  function forward(λ, φ) {
    var sign = φ < 0 ? -1 : +1,
        hemilobes = lobes[+(φ < 0)];
    for (var i = 0, n = hemilobes.length - 1; i < n && λ > hemilobes[i][2][0]; ++i);
    var coordinates = project(λ - hemilobes[i][1][0], φ);
    coordinates[0] += project(hemilobes[i][1][0], sign * φ > sign * hemilobes[i][0][1] ? hemilobes[i][0][1] : φ)[0];
    return coordinates;
  }

  function reset() {
    bounds = lobes.map(function(hemilobes) {
      return hemilobes.map(function(lobe) {
        var x0 = project(lobe[0][0], lobe[0][1])[0],
            x1 = project(lobe[2][0], lobe[2][1])[0],
            y0 = project(lobe[1][0], lobe[0][1])[1],
            y1 = project(lobe[1][0], lobe[1][1])[1],
            t;
        if (y0 > y1) t = y0, y0 = y1, y1 = t;
        return [[x0, y0], [x1, y1]];
      });
    });
  }

  // Assumes mutually exclusive bounding boxes for lobes.
  if (project.invert) forward.invert = function(x, y) {
    var hemibounds = bounds[+(y < 0)],
        hemilobes = lobes[+(y < 0)];
    for (var i = 0, n = hemibounds.length; i < n; ++i) {
      var b = hemibounds[i];
      if (b[0][0] <= x && x < b[1][0] && b[0][1] <= y && y < b[1][1]) {
        var coordinates = project.invert(x - project(hemilobes[i][1][0], 0)[0], y);
        coordinates[0] += hemilobes[i][1][0];
        return pointEqual(forward(coordinates[0], coordinates[1]), [x, y]) ? coordinates : null;
      }
    }
  };

  var projection = d3.geo.projection(forward),
      stream_ = projection.stream;

  projection.stream = function(stream) {
    var rotate = projection.rotate(),
        rotateStream = stream_(stream),
        sphereStream = (projection.rotate([0, 0]), stream_(stream));
    projection.rotate(rotate);
    rotateStream.sphere = function() { d3.geo.stream(sphere(), sphereStream); };
    return rotateStream;
  };

  projection.lobes = function(_) {
    if (!arguments.length) return lobes.map(function(lobes) {
      return lobes.map(function(lobe) {
        return [
          [lobe[0][0] * 180 / π, lobe[0][1] * 180 / π],
          [lobe[1][0] * 180 / π, lobe[1][1] * 180 / π],
          [lobe[2][0] * 180 / π, lobe[2][1] * 180 / π]
        ];
      });
    });
    lobes = _.map(function(lobes) {
      return lobes.map(function(lobe) {
        return [
          [lobe[0][0] * π / 180, lobe[0][1] * π / 180],
          [lobe[1][0] * π / 180, lobe[1][1] * π / 180],
          [lobe[2][0] * π / 180, lobe[2][1] * π / 180]
        ];
      });
    });
    reset();
    return projection;
  };

  function sphere() {
    var ε = 1e-6,
        coordinates = [];

    // Northern Hemisphere
    for (var i = 0, n = lobes[0].length; i < n; ++i) {
      var lobe = lobes[0][i],
          λ0 = lobe[0][0] * 180 / π,
          φ0 = lobe[0][1] * 180 / π,
          φ1 = lobe[1][1] * 180 / π,
          λ2 = lobe[2][0] * 180 / π,
          φ2 = lobe[2][1] * 180 / π;
      coordinates.push(resample([
        [λ0 + ε, φ0 + ε],
        [λ0 + ε, φ1 - ε],
        [λ2 - ε, φ1 - ε],
        [λ2 - ε, φ2 + ε]
      ], 30));
    }

    // Southern Hemisphere
    for (var i = lobes[1].length - 1; i >= 0; --i) {
      var lobe = lobes[1][i],
          λ0 = lobe[0][0] * 180 / π,
          φ0 = lobe[0][1] * 180 / π,
          φ1 = lobe[1][1] * 180 / π,
          λ2 = lobe[2][0] * 180 / π,
          φ2 = lobe[2][1] * 180 / π;
      coordinates.push(resample([
        [λ2 - ε, φ2 - ε],
        [λ2 - ε, φ1 + ε],
        [λ0 + ε, φ1 + ε],
        [λ0 + ε, φ0 - ε]
      ], 30));
    }

    return {
      type: "Polygon",
      coordinates: [d3.merge(coordinates)]
    };
  }

  function resample(coordinates, m) {
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

  function pointEqual(a, b) {
    return Math.abs(a[0] - b[0]) < ε && Math.abs(a[1] - b[1]) < ε;
  }

  return projection;
};
