// subdivide up to accuracy of 0.1 degrees
const MIN_RADIANS = 0.1 * Math.PI / 180;

// Adaptively sample an interpolated function over a domain extent
export default function(f, extent, minSteps, maxSteps) {
  minSteps = minSteps || 25;
  maxSteps = Math.max(minSteps, maxSteps || 200);

  const point = x => [x, f(x)],
        minX = extent[0],
        maxX = extent[1],
        span = maxX - minX,
        stop = span / maxSteps,
        prev = [point(minX)],
        next = [];

  if (minSteps === maxSteps) {
    // no adaptation, sample uniform grid directly and return
    for (let i = 1; i < maxSteps; ++i) {
      prev.push(point(minX + (i / minSteps) * span));
    }
    prev.push(point(maxX));
    return prev;
  } else {
    // sample minimum points on uniform grid
    // then move on to perform adaptive refinement
    next.push(point(maxX));
    for (let i = minSteps; --i > 0;) {
      next.push(point(minX + (i / minSteps) * span));
    }
  }

  let p0 = prev[0],
      p1 = next[next.length - 1];

  while (p1) {
    // midpoint for potential curve subdivision
    const pm = point((p0[0] + p1[0]) / 2);

    if (pm[0] - p0[0] >= stop && angleDelta(p0, pm, p1) > MIN_RADIANS) {
      // maximum resolution has not yet been met, and
      // subdivision midpoint sufficiently different from endpoint
      // save subdivision, push midpoint onto the visitation stack
      next.push(pm);
    } else {
      // subdivision midpoint sufficiently similar to endpoint
      // skip subdivision, store endpoint, move to next point on the stack
      p0 = p1;
      prev.push(p1);
      next.pop();
    }
    p1 = next[next.length - 1];
  }

  return prev;
}

function angleDelta(p, q, r) {
  const a0 = Math.atan2(r[1] - p[1], r[0] - p[0]),
        a1 = Math.atan2(q[1] - p[1], q[0] - p[0]);
  return Math.abs(a0 - a1);
}
