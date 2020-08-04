import value from '../value';
import {canvas} from 'vega-canvas';

function addStops(gradient, stops) {
  const n = stops.length;
  for (let i=0; i<n; ++i) {
    gradient.addColorStop(stops[i].offset, stops[i].color);
  }
  return gradient;
}

export default function(context, spec, bounds) {
  const w = bounds.width(),
        h = bounds.height();
  let gradient;


  if (spec.gradient === 'radial') {
    gradient = context.createRadialGradient(
      bounds.x1 + value(spec.x1, 0.5) * w,
      bounds.y1 + value(spec.y1, 0.5) * h,
      Math.max(w, h) * value(spec.r1, 0),
      bounds.x1 + value(spec.x2, 0.5) * w,
      bounds.y1 + value(spec.y2, 0.5) * h,
      Math.max(w, h) * value(spec.r2, 0.5)
    );
  } else { // linear gradient
    const x1 = value(spec.x1, 0),
          y1 = value(spec.y1, 0),
          x2 = value(spec.x2, 1),
          y2 = value(spec.y2, 0);

    if (x1 === x2 || y1 === y2 || w === h) {
      // axis aligned: use normal gradient
      gradient = context.createLinearGradient(
        bounds.x1 + x1 * w,
        bounds.y1 + y1 * h,
        bounds.x1 + x2 * w,
        bounds.y1 + y2 * h
      );
    } else {
      // not axis aligned: render gradient into a pattern (#2365)
      // this allows us to use normalized bounding box coordinates
      const image = canvas(Math.ceil(w), Math.ceil(h)),
            ictx = image.getContext('2d');

      ictx.scale(w, h);
      ictx.fillStyle = addStops(
        ictx.createLinearGradient(x1, y1, x2, y2),
        spec.stops
      );
      ictx.fillRect(0, 0, w, h);

      return context.createPattern(image, 'no-repeat');
    }
  }

  return addStops(gradient, spec.stops);
}
