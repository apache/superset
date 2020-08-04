import "projection";

function vanDerGrinten4(λ, φ) {
  if (!φ) return [λ, 0];
  var φ0 = Math.abs(φ);
  if (!λ || φ0 === halfπ) return [0, φ];
  var B = φ0 / halfπ,
      B2 = B * B,
      C = (8 * B - B2 * (B2 + 2) - 5) / (2 * B2 * (B - 1)),
      C2 = C * C,
      BC = B * C,
      B_C2 = B2 + C2 + 2 * BC,
      B_3C = B + 3 * C,
      λ0 = λ / halfπ,
      λ1 = λ0 + 1 / λ0,
      D = sgn(Math.abs(λ) - halfπ) * Math.sqrt(λ1 * λ1 - 4),
      D2 = D * D,
      F = B_C2 * (B2 + C2 * D2 - 1) + (1 - B2) * (B2 * (B_3C * B_3C + 4 * C2) + 12 * BC * C2 + 4 * C2 * C2),
      x1 = (D * (B_C2 + C2 - 1) + 2 * asqrt(F)) / (4 * B_C2 + D2);
  return [
    sgn(λ) * halfπ * x1,
    sgn(φ) * halfπ * asqrt(1 + D * Math.abs(x1) - x1 * x1)
  ];
}

vanDerGrinten4.invert = function(x, y) {
  if (!x || !y) return [x, y];
  y /= π;
  var x1 = sgn(x) * x / halfπ,
      D = (x1 * x1 - 1 + 4 * y * y) / Math.abs(x1),
      D2 = D * D,
      B = 2 * y,
      i = 50;
  do {
    var B2 = B * B,
        C = (8 * B - B2 * (B2 + 2) - 5) / (2 * B2 * (B - 1)),
        C_ = (3 * B - B2 * B - 10) / (2 * B2 * B),
        C2 = C * C,
        BC = B * C,
        B_C = B + C,
        B_C2 = B_C * B_C,
        B_3C = B + 3 * C,
        F = B_C2 * (B2 + C2 * D2 - 1) + (1 - B2) * (B2 * (B_3C * B_3C + 4 * C2) + C2 * (12 * BC + 4 * C2)),
        F_ = -2 * B_C * (4 * BC * C2 + (1 - 4 * B2 + 3 * B2 * B2) * (1 + C_) + C2 * (-6 + 14 * B2 - D2 + (-8 + 8 * B2 - 2 * D2) * C_) + BC * (-8 + 12 * B2 + (-10 + 10 * B2 - D2) * C_)),
        sqrtF = Math.sqrt(F),
        f = D * (B_C2 + C2 - 1) + 2 * sqrtF - x1 * (4 * B_C2 + D2),
        f_ = D * (2 * C * C_ + 2 * B_C * (1 + C_)) + F_ / sqrtF - 8 * B_C * (D * (-1 + C2 + B_C2) + 2 * sqrtF) * (1 + C_) / (D2 + 4 * B_C2);
    B -= δ = f / f_;
  } while (δ > ε && --i > 0);
  return [
    sgn(x) * (Math.sqrt(D * D + 4) + D) * π / 4,
    halfπ * B
  ];
};

(d3.geo.vanDerGrinten4 = function() { return projection(vanDerGrinten4); }).raw = vanDerGrinten4;
