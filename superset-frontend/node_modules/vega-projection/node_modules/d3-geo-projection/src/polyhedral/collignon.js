import {geoCentroid as centroid, geoProjection as projection} from "d3-geo";
import {collignonRaw} from "../collignon.js";
import {pi, sqrt} from "../math.js";
import polyhedral from "./index.js";
import octahedron from "./octahedron.js";

var kx = 2 / sqrt(3);

function collignonK(a, b) {
  var p = collignonRaw(a, b);
  return [p[0] * kx, p[1]];
}

collignonK.invert = function(x,y) {
  return collignonRaw.invert(x / kx, y);
};

export default function(faceProjection) {

  faceProjection = faceProjection || function(face) {
    var c = centroid({type: "MultiPoint", coordinates: face});
    return projection(collignonK).translate([0, 0]).scale(1).rotate(c[1] > 0 ? [-c[0], 0] : [180 - c[0], 180]);
  };

  var faces = octahedron.map(function(face) {
    return {face: face, project: faceProjection(face)};
  });

  [-1, 0, 0, 1, 0, 1, 4, 5].forEach(function(d, i) {
    var node = faces[d];
    node && (node.children || (node.children = [])).push(faces[i]);
  });

  return polyhedral(faces[0], function(lambda, phi) {
        return faces[lambda < -pi / 2 ? phi < 0 ? 6 : 4
            : lambda < 0 ? phi < 0 ? 2 : 0
            : lambda < pi / 2 ? phi < 0 ? 3 : 1
            : phi < 0 ? 7 : 5];
      })
      .angle(-30)
      .scale(121.906)
      .center([0, 48.5904]);
}
