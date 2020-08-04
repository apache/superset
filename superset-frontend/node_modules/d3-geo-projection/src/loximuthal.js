import "projection";
import "parallel1";

function loximuthal(φ0) {
  var cosφ0 = Math.cos(φ0),
      tanφ0 = Math.tan(π / 4 + φ0 / 2);

  function forward(λ, φ) {
    var y = φ - φ0,
        x = Math.abs(y) < ε ? λ * cosφ0
        : Math.abs(x = π / 4 + φ / 2) < ε || Math.abs(Math.abs(x) - halfπ) < ε
        ? 0 : λ * y / Math.log(Math.tan(x) / tanφ0);
    return [x, y];
  }

  forward.invert = function(x, y) {
    var λ,
        φ = y + φ0;
    return [
      Math.abs(y) < ε ? x / cosφ0
        : (Math.abs(λ = π / 4 + φ / 2) < ε || Math.abs(Math.abs(λ) - halfπ) < ε) ? 0
        : x * Math.log(Math.tan(λ) / tanφ0) / y,
      φ
    ];
  };

  return forward;
}

(d3.geo.loximuthal = function() { return parallel1Projection(loximuthal).parallel(40); }).raw = loximuthal;
