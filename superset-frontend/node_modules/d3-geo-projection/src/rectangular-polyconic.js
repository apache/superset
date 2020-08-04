import "projection";
import "parallel1";

function rectangularPolyconic(φ0) {
  var sinφ0 = Math.sin(φ0);

  function forward(λ, φ) {
    var A = sinφ0 ? Math.tan(λ * sinφ0 / 2) / sinφ0 : λ / 2;
    if (!φ) return [2 * A, -φ0];
    var E = 2 * Math.atan(A * Math.sin(φ)),
        cotφ = 1 / Math.tan(φ);
    return [
      Math.sin(E) * cotφ,
      φ + (1 - Math.cos(E)) * cotφ - φ0
    ];
  }

  // TODO return null for points outside outline.
  forward.invert = function(x, y) {
    if (Math.abs(y += φ0) < ε) return [sinφ0 ? 2 * Math.atan(sinφ0 * x / 2) / sinφ0 : x, 0];
    var k = x * x + y * y,
        φ = 0,
        i = 10, δ;
    do {
      var tanφ = Math.tan(φ),
          secφ = 1 / Math.cos(φ),
          j = k - 2 * y * φ + φ * φ;
      φ -= δ = (tanφ * j + 2 * (φ - y)) / (2 + j * secφ * secφ + 2 * (φ - y) * tanφ);
    } while (Math.abs(δ) > ε && --i > 0);
    var E = x * (tanφ = Math.tan(φ)),
        A = Math.tan(Math.abs(y) < Math.abs(φ + 1 / tanφ) ? asin(E) * .5 : acos(E) * .5 + π / 4) / Math.sin(φ);
    return [
      sinφ0 ? 2 * Math.atan(sinφ0 * A) / sinφ0 : 2 * A,
      φ
    ];
  };

  return forward;
}

(d3.geo.rectangularPolyconic = function() { return parallel1Projection(rectangularPolyconic); }).raw = rectangularPolyconic;
