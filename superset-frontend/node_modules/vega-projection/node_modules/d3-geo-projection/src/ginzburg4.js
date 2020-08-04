import {geoProjection as projection} from "d3-geo";
import ginzburgPolyconicRaw from "./ginzburgPolyconic.js";

export var ginzburg4Raw = ginzburgPolyconicRaw(2.8284, -1.6988, 0.75432, -0.18071, 1.76003, -0.38914, 0.042555);

export default function() {
  return projection(ginzburg4Raw)
      .scale(149.995);
}
