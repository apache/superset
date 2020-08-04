import "projection";

function aitoff(λ, φ) {
  var cosφ = Math.cos(φ),
      sinciα = sinci(acos(cosφ * Math.cos(λ /= 2)));
  return [
    2 * cosφ * Math.sin(λ) * sinciα,
    Math.sin(φ) * sinciα
  ];
}

aitoff.invert = function(x, y) {
  // Abort if [x, y] is not within an ellipse centered at [0, 0] with
  // semi-major axis π and semi-minor axis π/2.
  if (x * x + 4 * y * y > π * π + ε) return;

  var λ = x, φ = y, i = 25;
  do {
    var sinλ = Math.sin(λ),
        sinλ_2 = Math.sin(λ / 2),
        cosλ_2 = Math.cos(λ / 2),
        sinφ = Math.sin(φ),
        cosφ = Math.cos(φ),
        sin_2φ = Math.sin(2 * φ),
        sin2φ = sinφ * sinφ,
        cos2φ = cosφ * cosφ,
        sin2λ_2 = sinλ_2 * sinλ_2,
        C = 1 - cos2φ * cosλ_2 * cosλ_2,
        E = C ? acos(cosφ * cosλ_2) * Math.sqrt(F = 1 / C) : F = 0,
        F,
        fx = 2 * E * cosφ * sinλ_2 - x,
        fy = E * sinφ - y,
        δxδλ = F * (cos2φ * sin2λ_2 + E * cosφ * cosλ_2 * sin2φ),
        δxδφ = F * (.5 * sinλ * sin_2φ - E * 2 * sinφ * sinλ_2),
        δyδλ = F * .25 * (sin_2φ * sinλ_2 - E * sinφ * cos2φ * sinλ),
        δyδφ = F * (sin2φ * cosλ_2 + E * sin2λ_2 * cosφ),
        denominator = δxδφ * δyδλ - δyδφ * δxδλ;
    if (!denominator) break;
    var δλ = (fy * δxδφ - fx * δyδφ) / denominator,
        δφ = (fx * δyδλ - fy * δxδλ) / denominator;
    λ -= δλ, φ -= δφ;
  } while ((Math.abs(δλ) > ε || Math.abs(δφ) > ε) && --i > 0);
  return [λ, φ];
};

(d3.geo.aitoff = function() { return projection(aitoff); }).raw = aitoff;
