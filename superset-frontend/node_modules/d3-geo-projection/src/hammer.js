import "projection";

var hammerAzimuthalEqualArea = d3.geo.azimuthalEqualArea.raw;

function hammer(A, B) {
  if (arguments.length < 2) B = A;
  if (B === 1) return hammerAzimuthalEqualArea;
  if (B === Infinity) return hammerQuarticAuthalic;

  function forward(λ, φ) {
    var coordinates = hammerAzimuthalEqualArea(λ / B, φ);
    coordinates[0] *= A;
    return coordinates;
  }

  forward.invert = function(x, y) {
    var coordinates = hammerAzimuthalEqualArea.invert(x / A, y);
    coordinates[0] *= B;
    return coordinates;
  };

  return forward;
}

function hammerProjection() {
  var B = 2,
      m = projectionMutator(hammer),
      p = m(B);

  p.coefficient = function(_) {
    if (!arguments.length) return B;
    return m(B = +_);
  };

  return p;
}

function hammerQuarticAuthalic(λ, φ) {
  return [
    λ * Math.cos(φ) / Math.cos(φ /= 2),
    2 * Math.sin(φ)
  ];
}

hammerQuarticAuthalic.invert = function(x, y) {
  var φ = 2 * asin(y / 2);
  return [
    x * Math.cos(φ / 2) / Math.cos(φ),
    φ
  ];
};

(d3.geo.hammer = hammerProjection).raw = hammer;
