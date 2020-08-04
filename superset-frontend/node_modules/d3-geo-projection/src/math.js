var ε = 1e-6,
    ε2 = ε * ε,
    π = Math.PI,
    halfπ = π / 2,
    sqrtπ = Math.sqrt(π),
    radians = π / 180,
    degrees = 180 / π;

function sinci(x) {
  return x ? x / Math.sin(x) : 1;
}

function sgn(x) {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

function asin(x) {
  return x > 1 ? halfπ : x < -1 ? -halfπ : Math.asin(x);
}

function acos(x) {
  return x > 1 ? 0 : x < -1 ? π : Math.acos(x);
}

function asqrt(x) {
  return x > 0 ? Math.sqrt(x) : 0;
}
