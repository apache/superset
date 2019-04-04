import "projection";
import "mollweide";

var wagner4 = (function() {
  var A = 4 * π + 3 * Math.sqrt(3),
      B = 2 * Math.sqrt(2 * π * Math.sqrt(3) / A);
  return mollweideBromley(B * Math.sqrt(3) / π, B, A / 6);
})();

(d3.geo.wagner4 = function() { return projection(wagner4); }).raw = wagner4;
