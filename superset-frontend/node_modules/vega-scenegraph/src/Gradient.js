var gradient_id = 0;

export function resetSVGGradientId() {
  gradient_id = 0;
}

export const patternPrefix = 'p_';

export function isGradient(value) {
  return value && value.gradient;
}

export function gradientRef(g, defs, base) {
  let id = g.id,
      type = g.gradient,
      prefix = type === 'radial' ? patternPrefix : '';

  // check id, assign default values as needed
  if (!id) {
    id = g.id = 'gradient_' + (gradient_id++);
    if (type === 'radial') {
      g.x1 = get(g.x1, 0.5);
      g.y1 = get(g.y1, 0.5);
      g.r1 = get(g.r1, 0);
      g.x2 = get(g.x2, 0.5);
      g.y2 = get(g.y2, 0.5);
      g.r2 = get(g.r2, 0.5);
      prefix = patternPrefix;
    } else {
      g.x1 = get(g.x1, 0);
      g.y1 = get(g.y1, 0);
      g.x2 = get(g.x2, 1);
      g.y2 = get(g.y2, 0);
    }
  }

  // register definition
  defs[id] = g;

  // return url reference
  return 'url(' + (base || '') + '#' + prefix + id + ')';
}

function get(val, def) {
  return val != null ? val : def;
}

export default function(p0, p1) {
  var stops = [], gradient;
  return gradient = {
    gradient: 'linear',
    x1: p0 ? p0[0] : 0,
    y1: p0 ? p0[1] : 0,
    x2: p1 ? p1[0] : 1,
    y2: p1 ? p1[1] : 0,
    stops: stops,
    stop: function(offset, color) {
      stops.push({offset: offset, color: color});
      return gradient;
    }
  };
}
