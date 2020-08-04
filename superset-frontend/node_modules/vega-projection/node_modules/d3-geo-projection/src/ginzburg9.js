import {geoProjection as projection} from "d3-geo";
import ginzburgPolyconicRaw from "./ginzburgPolyconic.js";

export var ginzburg9Raw = ginzburgPolyconicRaw(2.6516, -0.76534, 0.19123, -0.047094, 1.36289, -0.13965,0.031762);

export default function() {
  return projection(ginzburg9Raw)
      .scale(131.087);
}
