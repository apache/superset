import {sinusoidalRaw} from "../sinusoidal.js";
import interrupt from "./index.js";

var lobes = [[ // northern hemisphere
  [[-180,   0], [-110,  90], [ -40,   0]],
  [[ -40,   0], [   0,  90], [  40,   0]],
  [[  40,   0], [ 110,  90], [ 180,   0]]
], [ // southern hemisphere
  [[-180,   0], [-110, -90], [ -40,   0]],
  [[ -40,   0], [   0, -90], [  40,   0]],
  [[  40,   0], [ 110, -90], [ 180,   0]]
]];

export default function() {
  return interrupt(sinusoidalRaw, lobes)
      .scale(152.63)
      .rotate([-20, 0]);
}
