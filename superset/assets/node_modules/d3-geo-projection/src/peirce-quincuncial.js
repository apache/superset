import "projection";
import "guyou";
import "quincuncial";

var peirceQuincuncialProjection = quincuncialProjection(guyou);

(d3.geo.peirceQuincuncial = function() { return peirceQuincuncialProjection().quincuncial(true).rotate([-90, -90, 45]).clipAngle(180 - 1e-6); }).raw = peirceQuincuncialProjection.raw;
