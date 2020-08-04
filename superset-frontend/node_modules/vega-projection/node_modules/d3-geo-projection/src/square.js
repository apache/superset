import {halfPi, pi} from "./math.js";

export default function(project) {
  var dx = project(halfPi, 0)[0] - project(-halfPi, 0)[0];

  function projectSquare(lambda, phi) {
    var s = lambda > 0 ? -0.5 : 0.5,
        point = project(lambda + s * pi, phi);
    point[0] -= s * dx;
    return point;
  }

  if (project.invert) projectSquare.invert = function(x, y) {
    var s = x > 0 ? -0.5 : 0.5,
        location = project.invert(x + s * dx, y),
        lambda = location[0] - s * pi;
    if (lambda < -pi) lambda += 2 * pi;
    else if (lambda > pi) lambda -= 2 * pi;
    location[0] = lambda;
    return location;
  };

  return projectSquare;
}
