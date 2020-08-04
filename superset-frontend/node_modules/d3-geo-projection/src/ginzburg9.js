import "projection";
import "ginzburg-polyconic";

var ginzburg9 = ginzburgPolyconic(2.6516, -.76534, .19123, -.047094, 1.36289, -.13965, .031762);

(d3.geo.ginzburg9 = function() { return projection(ginzburg9); }).raw = ginzburg9;
