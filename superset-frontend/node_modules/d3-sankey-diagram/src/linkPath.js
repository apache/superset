import { interpolate } from 'd3-interpolate'

// function defaultSegments (d) {
//   return d.segments
// }

function defaultMinWidth (d) {
  return (d.dy === 0) ? 0 : 2
}

export default function sankeyLink() {
  // var segments = defaultSegments
  var minWidth = defaultMinWidth

  function radiusBounds(d) {
    var Dx = d.x1 - d.x0,
        Dy = d.y1 - d.y0,
        Rmin = d.dy / 2,
        Rmax = (Dx*Dx + Dy*Dy) / Math.abs(4*Dy);
    return [Rmin, Rmax];
  }

  function link(d) {
    var path = ''
    var seg
    for (var i = 0; i < d.points.length - 1; ++i) {
      seg = {
        x0: d.points[i].x,
        y0: d.points[i].y,
        x1: d.points[i + 1].x,
        y1: d.points[i + 1].y,
        r0: d.points[i].ro,
        r1: d.points[i + 1].ri,
        d0: d.points[i].d,
        d1: d.points[i + 1].d,
        dy: d.dy
      }
      path += segmentPath(seg)
    }
    return path
  }

  function segmentPath (d) {
    var dir = (d.d0 || 'r') + (d.d1 || 'r');
    if (d.source && d.source === d.target) {
      return selfLink(d);
    }
    if (dir === 'rl') {
      return fbLink(d);
    }
    if (dir === 'rd') {
      return fdLink(d);
    }
    if (dir === 'dr') {
      return dfLink(d);
    }
    if (dir === 'lr') {
      return bfLink(d);
    }

    // Minimum thickness 2px
    var h = Math.max(minWidth(d), d.dy) / 2,
        x0 = d.x0,
        x1 = d.x1,
        y0 = d.y0,
        y1 = d.y1;

    if (x1 < x0) {
      [x0, x1] = [x1, x0];
      [y0, y1] = [y1, y0];
    }

    let f = y1 > y0 ? 1 : -1,
        fx = 1;  // dir === 'll' ? -1 : 1;

    const Rlim = radiusBounds(d),
          defaultRadius = Math.max(Rlim[0], Math.min(Rlim[1], (x1 - x0)/3));

    let r0 = Math.max(Rlim[0], Math.min(Rlim[1], (d.r0 || defaultRadius))),
        r1 = Math.max(Rlim[0], Math.min(Rlim[1], (d.r1 || defaultRadius)));

    const dcx = (x1 - x0),
          dcy = (y1 - y0) - f * (r0 + r1),
          D = Math.sqrt(dcx*dcx + dcy*dcy);

    const phi = -f * Math.acos(Math.min(1, (r0 + r1) / D)),
          psi = Math.atan2(dcy, dcx);

    let theta = Math.PI/2 + f * (psi + phi);

    let hs = h * f * Math.sin(theta),
        hc = h * Math.cos(theta),
        x2 = x0 + fx * r0 * Math.sin(Math.abs(theta)),
        x3 = x1 - fx * r1 * Math.sin(Math.abs(theta)),
        y2 = y0 + r0 * f * (1 - Math.cos(theta)),
        y3 = y1 - r1 * f * (1 - Math.cos(theta));

    if (isNaN(theta) || Math.abs(theta) < 1e-3) {
      theta = r0 = r1 = 0;
      x2 = x0;
      x3 = x1;
      y2 = y0;
      y3 = y1;
      hs = 0;
      hc = h;
    }

    function arc(dir, r) {
      var f = ( dir * (y1-y0) > 0) ? 1 : 0,
          rr = (fx * dir * (y1-y0) > 0) ? (r + h) : (r - h);
      // straight line
      if (theta === 0) { rr = r; }
      return "A" + rr + " " + rr + " " + Math.abs(theta) + " 0 " + f + " ";
    }

    var path;
    // if (fx * (x2 - x3) < 0 || Math.abs(y1 - y0) > 4*h) {
    // XXX this causes juddering during transitions

    path =  ("M"     + [x0,    y0-h ] + " " +
              arc(+1, r0) + [x2+hs, y2-hc] + " " +
            "L"     + [x3+hs, y3-hc] + " " +
              arc(-1, r1) + [x1,    y1-h ] + " " +
            "L"     + [x1,    y1+h ] + " " +
              arc(+1, r1) + [x3-hs, y3+hc] + " " +
            "L"     + [x2-hs, y2+hc] + " " +
              arc(-1, r0) + [x0,    y0+h ] + " " +
            "Z");
    
    if (/NaN/.test(path)) {
      console.error('path NaN', d, path);
    }
    return path;
  }

  function selfLink(d) {
    var h = Math.max(minWidth(d), d.dy) / 2,
        r = h*1.5,
        theta = 2 * Math.PI,
        x0 = d.x0,
        y0 = d.y0;

    function arc(dir) {
      var f = (dir > 0) ? 1 : 0,
          rr = (dir > 0) ? (r + h) : (r - h);
      return "A" + rr + " " + rr + " " + Math.abs(theta) + " 1 " + f + " ";
    }

    return ("M"     + [x0+0.1, y0-h] + " " +
            arc(+1) + [x0-0.1, y0-h] + " " +
            "L"     + [x0-0.1, y0+h] + " " +
            arc(-1) + [x0+0.1, y0+h] + " " +
            "Z");
  }

  function fbLink(d) {
    // Minimum thickness 2px
    var h = Math.max(minWidth(d), d.dy) / 2,
        x0 = d.x0,
        x1 = d.x1,
        y0 = d.y0,
        y1 = d.y1,
        Dx = d.x1 - d.x0,
        Dy = d.y1 - d.y0,
        //Rlim = radiusBounds(d),
        defaultRadius = ((d.r0 + d.r1) / 2) || (5 + h), //Math.max(Rlim[0], Math.min(Rlim[1], Dx/3)),
        r = Math.min(Math.abs(y1-y0)/2.1, defaultRadius), //2*(d.r || defaultRadius),
        theta = Math.atan2(Dy - 2*r, Dx),
        l = Math.sqrt(Math.max(0, Dx*Dx + (Dy-2*r)*(Dy-2*r))),
        f = d.y1 > d.y0 ? 1 : -1,
        hs = h * Math.sin(theta),
        hc = h * Math.cos(theta),
        x2 = d.x0 + r * Math.sin(Math.abs(theta)),
        x3 = d.x1 + r * Math.sin(Math.abs(theta)),
        y2 = d.y0 + r * f * (1 - Math.cos(theta)),
        y3 = d.y1 - r * f * (1 - Math.cos(theta));

    function arc(dir) {
      var f = (dir * theta > 0) ? 1 : 0,
          rr = (dir * theta > 0) ? (r + h) : (r - h);
      // straight line
      if (theta === 0) { rr = r; }
      return "A" + rr + " " + rr + " " + Math.abs(theta) + " 0 " + f + " ";
    }

    return ("M"     + [x0,    y0-h ] + " " +
            arc(+1) + [x2+hs, y2-hc] + " " +
            "L"     + [x3+hs, y3-hc] + " " +
            arc(+1) + [x1,    y1+h ] + " " +
            "L"     + [x1,    y1-h ] + " " +
            arc(-1) + [x3-hs, y3+hc] + " " +
            "L"     + [x2-hs, y2+hc] + " " +
            arc(-1) + [x0,    y0+h ] + " " +
            "Z");
  }

  function fdLink(d) {
    // Minimum thickness 2px
    var h = Math.max(minWidth(d), d.dy) / 2,
        x0 = d.x0,
        x1 = d.x1,
        y0 = d.y0,
        y1 = d.y1,
        Dx = d.x1 - d.x0,
        Dy = d.y1 - d.y0,
        theta = Math.PI / 2,
        r = Math.max(0, x1 - x0),
        f = d.y1 > d.y0,  // = 1
        y2 = y0 + r;

    function arc(dir) {
      var f = (dir * theta > 0) ? 1 : 0,
          rr = (dir * theta > 0) ? (r + h) : (r - h);
      // straight line
      if (theta === 0) { rr = r; }
      return "A" + rr + " " + rr + " " + Math.abs(theta) + " 0 " + f + " ";
    }

    return ("M"     + [x0,    y0-h ] + " " +
            arc(+1) + [x1+h,  y2   ] + " " +
            "L"     + [x1+h,  y1   ] + " " +
            ""      + [x1-h,  y1   ] + " " +
            ""      + [x1-h,  y2   ] + " " +
            arc(-1) + [x0,    y0+h ] + " " +
            "Z");
  }

  function dfLink(d) {
    // Minimum thickness 2px
    var h = Math.max(minWidth(d), d.dy) / 2,
        x0 = d.x0,
        x1 = d.x1,
        y0 = d.y0,
        y1 = d.y1,
        Dx = d.x1 - d.x0,
        Dy = d.y1 - d.y0,
        theta = Math.PI / 2,
        r = Math.max(0, x1 - x0),
        f = d.y1 > d.y0,  // = 1
        y2 = y1 - r;

    function arc(dir) {
      var f = (dir * theta > 0) ? 1 : 0,
          rr = (dir * theta > 0) ? (r + h) : (r - h);
      // straight line
      if (theta === 0) { rr = r; }
      return "A" + rr + " " + rr + " " + Math.abs(theta) + " 0 " + f + " ";
    }

    return ("M"     + [x0-h,  y0   ] + " " +
            "L"     + [x0+h,  y0   ] + " " +
            ""      + [x0+h,  y2   ] + " " +
            arc(-1) + [x1  ,  y1-h ] + " " +
            "L"     + [x1  ,  y1+h ] + " " +
            arc(+1) + [x0-h,  y2   ] + " " +
            "Z");
  }

  function bfLink(d) {
    // Minimum thickness 2px
    var h = Math.max(minWidth(d), d.dy) / 2,
        x0 = d.x0,
        x1 = d.x1,
        y0 = d.y0,
        y1 = d.y1,
        Dx = d.x1 - d.x0,
        Dy = d.y1 - d.y0,
        //Rlim = radiusBounds(d),
        defaultRadius = ((d.r0 + d.r1) / 2) || (5 + h), //Math.max(Rlim[0], Math.min(Rlim[1], Dx/3)),
        r = Math.min(Math.abs(Dy)/2.1, defaultRadius), //2*(d.r || defaultRadius),
        theta = Math.atan2(Dy - 2*r, Dx),
        l = Math.sqrt(Math.max(0, Dx*Dx + (Dy-2*r)*(Dy-2*r))),
        f = d.y1 > d.y0 ? 1 : -1,
        hs = h * Math.sin(theta),
        hc = h * Math.cos(theta),
        x2 = d.x0 - r * Math.sin(Math.abs(theta)),
        x3 = d.x1 - r * Math.sin(Math.abs(theta)),
        y2 = d.y0 + r * f * (1 - Math.cos(theta)),
        y3 = d.y1 - r * f * (1 - Math.cos(theta));

    function arc(dir) {
      var f = (dir * theta > 0) ? 1 : 0,
          rr = (-dir * theta > 0) ? (r + h) : (r - h);
      // straight line
      if (theta === 0) { rr = r; }
      return "A" + rr + " " + rr + " " + Math.abs(theta) + " 0 " + f + " ";
    }

    return ("M"     + [x0,    y0-h ] + " " +
            arc(-1) + [x2-hs, y2-hc] + " " +
            "L"     + [x3-hs, y3-hc] + " " +
            arc(-1) + [x1,    y1+h ] + " " +
            "L"     + [x1,    y1-h ] + " " +
            arc(+1) + [x3+hs, y3-hc] + " " +
            "L"     + [x2+hs, y2-hc] + " " +
            arc(+1) + [x0,    y0+h ] + " " +
            "Z");
  }

  link.minWidth = function (x) {
    if (arguments.length) {
      minWidth = required(x)
      return link
    }
    return minWidth
  }

  return link;
}

function required (f) {
  if (typeof f !== 'function') throw new Error()
  return f
}
