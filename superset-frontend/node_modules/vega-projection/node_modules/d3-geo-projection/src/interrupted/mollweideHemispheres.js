import {mollweideRaw} from "../mollweide.js";
import interrupt from "./index.js";

var lobes = [[ // northern hemisphere
  [[-180,   0], [ -90,  90], [   0,   0]],
  [[   0,   0], [  90,  90], [ 180,   0]]
], [ // southern hemisphere
  [[-180,   0], [ -90, -90], [   0,   0]],
  [[   0,   0], [  90, -90], [ 180,   0]]
]];

export default function() {
  return interrupt(mollweideRaw, lobes)
      .scale(169.529)
      .rotate([20, 0]);
}
