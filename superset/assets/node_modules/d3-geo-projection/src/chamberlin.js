import "projection";

function chamberlin(points) {
  points = points.map(function(p) {
    return [p[0], p[1], Math.sin(p[1]), Math.cos(p[1])];
  });

  for (var a = points[2], b, i = 0; i < 3; ++i, a = b) {
    b = points[i];
    a.v = chamberlinDistanceAzimuth(b[1] - a[1], a[3], a[2], b[3], b[2], b[0] - a[0]);
    a.point = [0, 0];
  }

  var β0 = chamberlinAngle(points[0].v[0], points[2].v[0], points[1].v[0]),
      β1 = chamberlinAngle(points[0].v[0], points[1].v[0], points[2].v[0]),
      β2 = π - β0;

  points[2].point[1] = 0;
  points[0].point[0] = -(points[1].point[0] = .5 * points[0].v[0]);

  var mean = [
    points[2].point[0] = points[0].point[0] + points[2].v[0] * Math.cos(β0),
    2 * (points[0].point[1] = points[1].point[1] = points[2].v[0] * Math.sin(β0))
  ];

  function forward(λ, φ) {
    var sinφ = Math.sin(φ),
        cosφ = Math.cos(φ),
        v = new Array(3);

    // Compute distance and azimuth from control points.
    for (var i = 0; i < 3; ++i) {
      var p = points[i];
      v[i] = chamberlinDistanceAzimuth(φ - p[1], p[3], p[2], cosφ, sinφ, λ - p[0]);
      if (!v[i][0]) return p.point;
      v[i][1] = chamberlinLongitude(v[i][1] - p.v[1]);
    }

    // Arithmetic mean of interception points.
    var point = mean.slice();
    for (var i = 0; i < 3; ++i) {
      var j = i == 2 ? 0 : i + 1;
      var a = chamberlinAngle(points[i].v[0], v[i][0], v[j][0]);
      if (v[i][1] < 0) a = -a;

      if (!i) {
        point[0] += v[i][0] * Math.cos(a);
        point[1] -= v[i][0] * Math.sin(a);
      } else if (i == 1) {
        a = β1 - a;
        point[0] -= v[i][0] * Math.cos(a);
        point[1] -= v[i][0] * Math.sin(a);
      } else {
        a = β2 - a;
        point[0] += v[i][0] * Math.cos(a);
        point[1] += v[i][0] * Math.sin(a);
      }
    }

    point[0] /= 3, point[1] /= 3;
    return point;
  }

  return forward;
}

function chamberlinProjection() {
  var points = [[0, 0], [0, 0], [0, 0]],
      m = projectionMutator(chamberlin),
      p = m(points),
      rotate = p.rotate;

  delete p.rotate;

  p.points = function(_) {
    if (!arguments.length) return points;
    points = _;
    var origin = d3.geo.centroid({type: "MultiPoint", coordinates: points}),
        r = [-origin[0], -origin[1]];
    rotate.call(p, r);
    return m(points.map(d3.geo.rotation(r)).map(chamberlinRadians));
  };

  return p.points([[-150, 55], [-35, 55], [-92.5, 10]]);
}

function chamberlinDistanceAzimuth(dφ, c1, s1, c2, s2, dλ) {
  var cosdλ = Math.cos(dλ),
      r;
  if (Math.abs(dφ) > 1 || Math.abs(dλ) > 1) {
    r = acos(s1 * s2 + c1 * c2 * cosdλ);
  } else {
    var sindφ = Math.sin(.5 * dφ), sindλ = Math.sin(.5 * dλ);
    r = 2 * asin(Math.sqrt(sindφ * sindφ + c1 * c2 * sindλ * sindλ));
  }
  if (Math.abs(r) > ε) {
    return [r, Math.atan2(c2 * Math.sin(dλ), c1 * s2 - s1 * c2 * cosdλ)];
  }
  return [0, 0];
}

// Angle opposite a, and contained between sides of lengths b and c.
function chamberlinAngle(b, c, a) {
  return acos(.5 * (b * b + c * c - a * a) / (b * c));
}

// Normalize longitude.
function chamberlinLongitude(λ) {
  return λ - 2 * π * Math.floor((λ + π) / (2 * π));
}

function chamberlinRadians(point) {
  return [point[0] * radians, point[1] * radians];
}

(d3.geo.chamberlin = chamberlinProjection).raw = chamberlin;
