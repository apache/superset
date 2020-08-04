import "projection";

function parallel1Projection(projectAt) {
  var φ0 = 0,
      m = projectionMutator(projectAt),
      p = m(φ0);

  p.parallel = function(_) {
    if (!arguments.length) return φ0 / π * 180;
    return m(φ0 = _ * π / 180);
  };

  return p;
}
