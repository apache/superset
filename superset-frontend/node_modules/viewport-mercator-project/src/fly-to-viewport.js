import {lerp} from './math-utils';
import {
  scaleToZoom,
  zoomToScale,
  lngLatToWorld,
  worldToLngLat
} from './web-mercator-utils';
import * as vec2 from 'gl-matrix/vec2';

const EPSILON = 0.01;
const VIEWPORT_TRANSITION_PROPS = ['longitude', 'latitude', 'zoom'];
const DEFAULT_OPTS = {
  curve: 1.414,
  speed: 1.2
  // screenSpeed and maxDuration are used only if specified
};

/**
 * mapbox-gl-js flyTo : https://www.mapbox.com/mapbox-gl-js/api/#map#flyto.
 * It implements “Smooth and efficient zooming and panning.” algorithm by
 * "Jarke J. van Wijk and Wim A.A. Nuij"
*/
export default function flyToViewport(startProps, endProps, t, opts = {}) {
  // Equations from above paper are referred where needed.

  const viewport = {};

  const {
    startZoom, startCenterXY, uDelta, w0, u1, S, rho, rho2, r0
  } = getFlyToTransitionParams(startProps, endProps, opts);

  // If change in center is too small, do linear interpolaiton.
  if (u1 < EPSILON) {
    for (const key of VIEWPORT_TRANSITION_PROPS) {
      const startValue = startProps[key];
      const endValue = endProps[key];
      viewport[key] = lerp(startValue, endValue, t);
    }
    return viewport;
  }

  const s = t * S;

  const w = (Math.cosh(r0) / Math.cosh(r0 + rho * s));
  const u = w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2) / u1;

  const scaleIncrement = 1 / w; // Using w method for scaling.
  const newZoom = startZoom + scaleToZoom(scaleIncrement);

  const newCenterWorld = vec2.scale([], uDelta, u);
  vec2.add(newCenterWorld, newCenterWorld, startCenterXY);
  vec2.scale(newCenterWorld, newCenterWorld, scaleIncrement);

  const newCenter = worldToLngLat(
    newCenterWorld,
    zoomToScale(newZoom));
  viewport.longitude = newCenter[0];
  viewport.latitude = newCenter[1];
  viewport.zoom = newZoom;
  return viewport;
}

// returns transition duration in milliseconds
export function getFlyToDuration(startProps, endProps, opts = {}) {

  opts = Object.assign({}, DEFAULT_OPTS, opts);
  const {screenSpeed, speed, maxDuration} = opts;
  const {S, rho} = getFlyToTransitionParams(startProps, endProps, opts);
  const length =  1000 * S;
  let duration;
  if (Number.isFinite(screenSpeed)) {
    duration = length / (screenSpeed / rho);
  } else {
    duration = length / speed;
  }

  return Number.isFinite(maxDuration) && duration > maxDuration ? 0 : duration;
}

// Private Methods

// Calculate all parameters that are static for given startProps and endProps
function getFlyToTransitionParams(startProps, endProps, opts) {

  opts = Object.assign({}, DEFAULT_OPTS, opts);
  const rho = opts.curve;
  const startZoom = startProps.zoom;
  const startCenter = [startProps.longitude, startProps.latitude];
  const startScale = zoomToScale(startZoom);
  const endZoom = endProps.zoom;
  const endCenter = [endProps.longitude, endProps.latitude];
  const scale = zoomToScale(endZoom - startZoom);

  const startCenterXY = lngLatToWorld(startCenter, startScale);
  const endCenterXY = lngLatToWorld(endCenter, startScale);
  const uDelta = vec2.sub([], endCenterXY, startCenterXY);

  const w0 = Math.max(startProps.width, startProps.height);
  const w1 = w0 / scale;
  const u1 = vec2.length(uDelta);
  // u0 is treated as '0' in Eq (9).

  // If u1 is too small, will generate invalid number
  const _u1 = Math.max(u1, EPSILON);

  // Implement Equation (9) from above algorithm.
  const rho2 = rho * rho;
  const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * _u1 * _u1) / (2 * w0 * rho2 * _u1);
  const b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * _u1 * _u1) / (2 * w1 * rho2 * _u1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;

  return {startZoom, startCenterXY, uDelta, w0, u1, S, rho, rho2, r0, r1};
}
