import "projection";
import "ginzburg-polyconic";

var ginzburg5 = ginzburgPolyconic(2.583819, -.835827, .170354, -.038094, 1.543313, -.411435, .082742);

(d3.geo.ginzburg5 = function() { return projection(ginzburg5); }).raw = ginzburg5;
