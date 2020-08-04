import "projection";
import "mollweide";

function boggs(λ, φ) {
  var k = 2.00276,
      θ = mollweideθ(φ);
  return [
    k * λ / (1 / Math.cos(φ) + 1.11072 / Math.cos(θ)),
    (φ + Math.SQRT2 * Math.sin(θ)) / k
  ];
}

boggs.invert = function(x, y) {
  var k = 2.00276,
      ky = k * y,
      θ = y < 0 ? -π / 4 : π / 4, i = 25, δ, φ;
  do {
    φ = ky - Math.SQRT2 * Math.sin(θ);
    θ -= δ = (Math.sin(2 * θ) + 2 * θ - π * Math.sin(φ)) / (2 * Math.cos(2 * θ) + 2 + π * Math.cos(φ) * Math.SQRT2 * Math.cos(θ));
  } while (Math.abs(δ) > ε && --i > 0);
  φ = ky - Math.SQRT2 * Math.sin(θ);
  return [
    x * (1 / Math.cos(φ) + 1.11072 / Math.cos(θ)) / k,
    φ
  ];
};

(d3.geo.boggs = function() { return projection(boggs); }).raw = boggs;
