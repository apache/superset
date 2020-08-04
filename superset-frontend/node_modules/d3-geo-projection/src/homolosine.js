import "projection";
import "mollweide";
import "sinusoidal";
import "sinu-mollweide";

function homolosine(λ, φ) {
  return Math.abs(φ) > sinuMollweideφ
      ? (λ = mollweide(λ, φ), λ[1] -= φ > 0 ? sinuMollweideY : -sinuMollweideY, λ)
      : sinusoidal(λ, φ);
}

homolosine.invert = function(x, y) {
  return Math.abs(y) > sinuMollweideφ
      ? mollweide.invert(x, y + (y > 0 ? sinuMollweideY : -sinuMollweideY))
      : sinusoidal.invert(x, y);
};

(d3.geo.homolosine = function() { return projection(homolosine); }).raw = homolosine;
