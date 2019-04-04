import "projection";
import "elliptic";
import "quincuncial";

// √k' tn(½K - w) = exp(-ζ).
function guyou(λ, φ) {

  var k_ = (Math.SQRT2 - 1) / (Math.SQRT2 + 1),
      k = Math.sqrt(1 - k_ * k_),
      K = ellipticF(halfπ, k * k),
      f = -1;

  var ψ = Math.log(Math.tan(π / 4 + Math.abs(φ) / 2)),
      r = Math.exp(f * ψ) / Math.sqrt(k_),
      at = guyouComplexAtan(r * Math.cos(f * λ), r * Math.sin(f * λ)),
      t = ellipticFi(at[0], at[1], k * k);

  return [-t[1], (φ >= 0 ? 1 : -1) * (.5 * K - t[0])];
}

function guyouComplexAtan(x, y) {
  var x2 = x * x,
      y_1 = y + 1,
      t = 1 - x2 - y * y;
  return [
    .5 * ((x >= 0 ? halfπ : -halfπ) - Math.atan2(t, 2 * x)),
    -.25 * Math.log(t * t + 4 * x2) + .5 * Math.log(y_1 * y_1 + x2)
  ];
}

function guyouComplexDivide(a, b) {
  var denominator = b[0] * b[0] + b[1] * b[1];
  return [
    (a[0] * b[0] + a[1] * b[1]) / denominator,
    (a[1] * b[0] - a[0] * b[1]) / denominator
  ];
}

guyou.invert = function(x, y) {
  var k_ = (Math.SQRT2 - 1) / (Math.SQRT2 + 1),
      k = Math.sqrt(1 - k_ * k_),
      K = ellipticF(halfπ, k * k),
      f = -1;

  var j = ellipticJi(.5 * K - y, -x, k * k),
      tn = guyouComplexDivide(j[0], j[1]),
      λ = Math.atan2(tn[1], tn[0]) / f;

  return [
    λ,
    2 * Math.atan(Math.exp(.5 / f * Math.log(k_ * tn[0] * tn[0] + k_ * tn[1] * tn[1]))) - halfπ
  ];
};

d3.geo.guyou = quincuncialProjection(guyou);
