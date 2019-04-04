import "projection";
import "mollweide";
import "sinusoidal";

var sinuMollweideφ = .7109889596207567,
    sinuMollweideY = .0528035274542;

function sinuMollweide(λ, φ) {
  return φ > -sinuMollweideφ
      ? (λ = mollweide(λ, φ), λ[1] += sinuMollweideY, λ)
      : sinusoidal(λ, φ);
}

sinuMollweide.invert = function(x, y) {
  return y > -sinuMollweideφ
      ? mollweide.invert(x, y - sinuMollweideY)
      : sinusoidal.invert(x, y);
};

(d3.geo.sinuMollweide = function() { return projection(sinuMollweide).rotate([-20, -55]); }).raw = sinuMollweide;
