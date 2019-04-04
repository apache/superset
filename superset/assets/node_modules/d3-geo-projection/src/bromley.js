import "projection";
import "mollweide";

var bromley = mollweideBromley(1, 4 / π, π);

(d3.geo.bromley = function() { return projection(bromley); }).raw = bromley;
