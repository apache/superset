import "projection";

function modifiedStereographic(C) {
  var m = C.length - 1;

  function forward(λ, φ) {
    var cosφ = Math.cos(φ),
        k = 2 / (1 + cosφ * Math.cos(λ)),
        zr = k * cosφ * Math.sin(λ),
        zi = k * Math.sin(φ),
        i = m,
        w = C[i],
        ar = w[0],
        ai = w[1],
        t;
    while (--i >= 0) {
      w = C[i];
      ar = w[0] + zr * (t = ar) - zi * ai;
      ai = w[1] + zr * ai + zi * t;
    }
    ar = zr * (t = ar) - zi * ai;
    ai = zr * ai + zi * t;
    return [ar, ai];
  }

  forward.invert = function(x, y) {
    var i = 20,
        zr = x,
        zi = y;
    do {
      var j = m,
          w = C[j],
          ar = w[0],
          ai = w[1],
          br = 0,
          bi = 0,
          t;

      while (--j >= 0) {
        w = C[j];
        br = ar + zr * (t = br) - zi * bi;
        bi = ai + zr * bi + zi * t;
        ar = w[0] + zr * (t = ar) - zi * ai;
        ai = w[1] + zr * ai + zi * t;
      }
      br = ar + zr * (t = br) - zi * bi;
      bi = ai + zr * bi + zi * t;
      ar = zr * (t = ar) - zi * ai - x;
      ai = zr * ai + zi * t - y;

      var denominator = br * br + bi * bi, δr, δi;
      zr -= δr = (ar * br + ai * bi) / denominator;
      zi -= δi = (ai * br - ar * bi) / denominator;
    } while (Math.abs(δr) + Math.abs(δi) > ε * ε && --i > 0);

    if (i) {
      var ρ = Math.sqrt(zr * zr + zi * zi),
          c = 2 * Math.atan(ρ * .5),
          sinc = Math.sin(c);
      return [Math.atan2(zr * sinc, ρ * Math.cos(c)), ρ ? asin(zi * sinc / ρ) : 0];
    }
  };

  return forward;
}

var modifiedStereographicCoefficients = {
  alaska: [
    [ .9972523, 0],
    [ .0052513, -.0041175],
    [ .0074606,  .0048125],
    [-.0153783, -.1968253],
    [ .0636871, -.1408027],
    [ .3660976, -.2937382]
  ],
  gs48: [[.98879, 0], [0, 0], [-.050909, 0], [0, 0], [.075528, 0]],
  gs50: [
    [ .9842990, 0],
    [ .0211642,  .0037608],
    [-.1036018, -.0575102],
    [-.0329095, -.0320119],
    [ .0499471,  .1223335],
    [ .0260460,  .0899805],
    [ .0007388, -.1435792],
    [ .0075848, -.1334108],
    [-.0216473,  .0776645],
    [-.0225161,  .0853673]
  ],
  miller: [[.9245, 0], [0, 0], [.01943, 0]],
  lee: [[.721316, 0], [0, 0], [-.00881625, -.00617325]]
};

function modifiedStereographicProjection() {
  var coefficients = modifiedStereographicCoefficients.miller,
      m = projectionMutator(modifiedStereographic),
      p = m(coefficients);

  p.coefficients = function(_) {
    if (!arguments.length) return coefficients;
    return m(coefficients = typeof _ === "string" ? modifiedStereographicCoefficients[_] : _);
  };

  return p;
}

(d3.geo.modifiedStereographic = modifiedStereographicProjection).raw = modifiedStereographic;
