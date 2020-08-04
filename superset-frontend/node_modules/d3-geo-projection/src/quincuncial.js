import "projection";

function quincuncialProjection(projectHemisphere) {
  var dx = projectHemisphere(halfπ, 0)[0] - projectHemisphere(-halfπ, 0)[0];

  function projection() {
    var quincuncial = false,
        m = projectionMutator(projectAt),
        p = m(quincuncial);

    p.quincuncial = function(_) {
      if (!arguments.length) return quincuncial;
      return m(quincuncial = !!_);
    };

    return p;
  }

  function projectAt(quincuncial) {
    var forward = quincuncial ? function(λ, φ) {
      var t = Math.abs(λ) < halfπ,
          p = projectHemisphere(t ? λ : λ > 0 ? λ - π : λ + π, φ);

      var x = (p[0] - p[1]) * Math.SQRT1_2,
          y = (p[0] + p[1]) * Math.SQRT1_2;

      if (t) return [x, y];

      var d = dx * Math.SQRT1_2,
          s = x > 0 ^ y > 0 ? -1 : 1;

      return [s * x - sgn(y) * d, s * y - sgn(x) * d];
    } : function(λ, φ) {
      var s = λ > 0 ? -.5 : .5,
          point = projectHemisphere(λ + s * π, φ);
      point[0] -= s * dx;
      return point;
    };

    if (projectHemisphere.invert) forward.invert = quincuncial ? function(x0, y0) {
      var x = (x0 + y0) * Math.SQRT1_2,
          y = (y0 - x0) * Math.SQRT1_2,
          t = Math.abs(x) < .5 * dx && Math.abs(y) < .5 * dx;

      if (!t) {
        var d = dx * Math.SQRT1_2,
            s = x > 0 ^ y > 0 ? -1 : 1,
            x1 = -s * (x0 + (y > 0 ? 1 : -1) * d),
            y1 = -s * (y0 + (x > 0 ? 1 : -1) * d);
        x = (-x1 - y1) * Math.SQRT1_2;
        y = (x1 - y1) * Math.SQRT1_2;
      }

      var p = projectHemisphere.invert(x, y);
      if (!t) p[0] += x > 0 ? π : -π;
      return p;
    } : function(x, y) {
      var s = x > 0 ? -.5 : .5,
          location = projectHemisphere.invert(x + s * dx, y),
          λ = location[0] - s * π;
      if (λ < -π) λ += 2 * π;
      else if (λ > π) λ -= 2 * π;
      location[0] = λ;
      return location;
    };

    return forward;
  }

  projection.raw = projectAt;

  return projection;
}
