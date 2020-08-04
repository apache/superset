import {atan, degrees, sqrt1_2} from "../math.js";

var phi1 = atan(sqrt1_2) * degrees;

var cube = [
  [0, phi1], [90, phi1], [180, phi1], [-90, phi1],
  [0, -phi1], [90, -phi1], [180, -phi1], [-90, -phi1]
];

export default [
  [0, 3, 2, 1], // N
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
  [4, 5, 6, 7] // S
].map(function(face) {
  return face.map(function(i) {
    return cube[i];
  });
});
