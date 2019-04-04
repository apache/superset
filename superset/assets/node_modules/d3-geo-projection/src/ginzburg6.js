import "projection";
import "ginzburg-polyconic";

var ginzburg6 = ginzburgPolyconic(5 / 6 * π, -.62636, -.0344, 0, 1.3493, -.05524, 0, .045);

(d3.geo.ginzburg6 = function() { return projection(ginzburg6); }).raw = ginzburg6;
