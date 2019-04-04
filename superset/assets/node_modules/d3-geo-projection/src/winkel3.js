import "projection";
import "aitoff";

function winkel3(λ, φ) {
  var coordinates = aitoff(λ, φ);
  return [
    (coordinates[0] + λ / halfπ) / 2,
    (coordinates[1] + φ) / 2
  ];
}

winkel3.invert = function(x, y) {
  var λ = x, φ = y, i = 25;
  do {
    var cosφ = Math.cos(φ),
        sinφ = Math.sin(φ),
        sin_2φ = Math.sin(2 * φ),
        sin2φ = sinφ * sinφ,
        cos2φ = cosφ * cosφ,
        sinλ = Math.sin(λ),
        cosλ_2 = Math.cos(λ / 2),
        sinλ_2 = Math.sin(λ / 2),
        sin2λ_2 = sinλ_2 * sinλ_2,
        C = 1 - cos2φ * cosλ_2 * cosλ_2,
        E = C ? acos(cosφ * cosλ_2) * Math.sqrt(F = 1 / C) : F = 0,
        F,
        fx = .5 * (2 * E * cosφ * sinλ_2 + λ / halfπ) - x,
        fy = .5 * (E * sinφ + φ) - y,
        δxδλ = .5 * F * (cos2φ * sin2λ_2 + E * cosφ * cosλ_2 * sin2φ) + .5 / halfπ,
        δxδφ = F * (sinλ * sin_2φ / 4 - E * sinφ * sinλ_2),
        δyδλ = .125 * F * (sin_2φ * sinλ_2 - E * sinφ * cos2φ * sinλ),
        δyδφ = .5 * F * (sin2φ * cosλ_2 + E * sin2λ_2 * cosφ) + .5,
        denominator = δxδφ * δyδλ - δyδφ * δxδλ,
        δλ = (fy * δxδφ - fx * δyδφ) / denominator,
        δφ = (fx * δyδλ - fy * δxδλ) / denominator;
    λ -= δλ, φ -= δφ;
  } while ((Math.abs(δλ) > ε || Math.abs(δφ) > ε) && --i > 0);
  return [λ, φ];
};

(d3.geo.winkel3 = function() { return projection(winkel3); }).raw = winkel3;
