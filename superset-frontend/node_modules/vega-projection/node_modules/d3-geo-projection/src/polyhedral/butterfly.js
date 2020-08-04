import {geoCentroid as centroid, geoGnomonic as gnomonic} from "d3-geo";
import {pi} from "../math.js";
import polyhedral from "./index.js";
import octahedron from "./octahedron.js";

export default function(faceProjection) {

  faceProjection = faceProjection || function(face) {
    var c = centroid({type: "MultiPoint", coordinates: face});
    return gnomonic().scale(1).translate([0, 0]).rotate([-c[0], -c[1]]);
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
      .scale(101.858)
      .center([0, 45]);
}
