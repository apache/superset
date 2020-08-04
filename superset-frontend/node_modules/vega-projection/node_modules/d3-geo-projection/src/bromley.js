import {geoProjection as projection} from "d3-geo";
import {pi} from "./math.js";
import {mollweideBromleyRaw} from "./mollweide.js";

export var bromleyRaw = mollweideBromleyRaw(1, 4 / pi, pi);

export default function() {
  return projection(bromleyRaw)
      .scale(152.63);
}
