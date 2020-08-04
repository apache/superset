export function findFirst(links, p) {
  let jmid = null;
  for (let j = 0; j < links.length; ++j) {
    if (p(links[j])) { jmid = j; break; }
  }
  return jmid;
}


/**
 * Adjust radii of curvature to avoid overlaps, as much as possible.
 * @param links - the list of links, ordered from outside to inside of bend
 * @param rr - "r0" or "r1", the side to work on
 */
export function sweepCurvatureInwards(links, rr) {
  if (links.length === 0) return;

  // sweep from inside of curvature towards outside
  let Rmin = 0, h;
  for (let i = links.length - 1; i >= 0; --i) {
    h = links[i].dy / 2;
    if (links[i][rr] - h < Rmin) {  // inner radius
      links[i][rr] = Math.min(links[i].Rmax, Rmin + h);
    }
    Rmin = links[i][rr] + h;
  }

  // sweep from outside of curvature towards centre
  let Rmax = links[0].Rmax + links[0].dy / 2;
  for (let i = 0; i < links.length; ++i) {
    h = links[i].dy / 2;
    if (links[i][rr] + h > Rmax) {  // outer radius
      links[i][rr] = Math.max(h, Rmax - h);
    }
    Rmax = links[i][rr] - h;
  }

}
