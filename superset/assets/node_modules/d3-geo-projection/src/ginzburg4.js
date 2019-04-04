import "projection";
import "ginzburg-polyconic";

var ginzburg4 = ginzburgPolyconic(2.8284, -1.6988, .75432, -.18071, 1.76003, -.38914, .042555);

(d3.geo.ginzburg4 = function() { return projection(ginzburg4); }).raw = ginzburg4;
