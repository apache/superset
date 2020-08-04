import "projection";

function vanDerGrinten(λ, φ) {
  if (Math.abs(φ) < ε) return [λ, 0];
  var sinθ = Math.abs(φ / halfπ),
      θ = asin(sinθ);
  if (Math.abs(λ) < ε || Math.abs(Math.abs(φ) - halfπ) < ε) return [0, sgn(φ) * π * Math.tan(θ / 2)];
  var cosθ = Math.cos(θ),
      A = Math.abs(π / λ - λ / π) / 2,
      A2 = A * A,
      G = cosθ / (sinθ + cosθ - 1),
      P = G * (2 / sinθ - 1),
      P2 = P * P,
      P2_A2 = P2 + A2,
      G_P2 = G - P2,
      Q = A2 + G;
  return [
    sgn(λ) * π * (A * G_P2 + Math.sqrt(A2 * G_P2 * G_P2 - P2_A2 * (G * G - P2))) / P2_A2,
    sgn(φ) * π * (P * Q - A * Math.sqrt((A2 + 1) * P2_A2 - Q * Q)) / P2_A2
  ];
}

vanDerGrinten.invert = function(x, y) {
  if (Math.abs(y) < ε) return [x, 0];
  if (Math.abs(x) < ε) return [0, halfπ * Math.sin(2 * Math.atan(y / π))];
  var x2 = (x /= π) * x,
      y2 = (y /= π) * y,
      x2_y2 = x2 + y2,
      z = x2_y2 * x2_y2,
      c1 = -Math.abs(y) * (1 + x2_y2),
      c2 = c1 - 2 * y2 + x2,
      c3 = -2 * c1 + 1 + 2 * y2 + z,
      d = y2 / c3 + (2 * c2 * c2 * c2 / (c3 * c3 * c3) - 9 * c1 * c2 / (c3 * c3)) / 27,
      a1 = (c1 - c2 * c2 / (3 * c3)) / c3,
      m1 = 2 * Math.sqrt(-a1 / 3),
      θ1 = acos(3 * d / (a1 * m1)) / 3;
  return [
    π * (x2_y2 - 1 + Math.sqrt(1 + 2 * (x2 - y2) + z)) / (2 * x),
    sgn(y) * π * (-m1 * Math.cos(θ1 + π / 3) - c2 / (3 * c3))
  ];
};

(d3.geo.vanDerGrinten = function() { return projection(vanDerGrinten); }).raw = vanDerGrinten;
