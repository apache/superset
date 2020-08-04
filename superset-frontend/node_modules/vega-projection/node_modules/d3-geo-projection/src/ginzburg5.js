import {geoProjection as projection} from "d3-geo";
import ginzburgPolyconicRaw from "./ginzburgPolyconic.js";

export var ginzburg5Raw = ginzburgPolyconicRaw(2.583819, -0.835827, 0.170354, -0.038094, 1.543313, -0.411435,0.082742);

export default function() {
  return projection(ginzburg5Raw)
      .scale(153.93);
}
