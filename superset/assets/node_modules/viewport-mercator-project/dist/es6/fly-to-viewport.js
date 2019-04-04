import { lerp } from './math-utils';
import { scaleToZoom, zoomToScale, lngLatToWorld, worldToLngLat } from './web-mercator-utils';
import * as vec2 from 'gl-matrix/vec2';
const EPSILON = 0.01;
const VIEWPORT_TRANSITION_PROPS = ['longitude', 'latitude', 'zoom'];
export default function flyToViewport(startProps, endProps, t) {
  const viewport = {};
  const rho = 1.414;
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

  if (Math.abs(u1) < EPSILON) {
    for (const key of VIEWPORT_TRANSITION_PROPS) {
      const startValue = startProps[key];
      const endValue = endProps[key];
      viewport[key] = lerp(startValue, endValue, t);
    }

    return viewport;
  }

  const rho2 = rho * rho;
  const b0 = (w1 * w1 - w0 * w0 + rho2 * rho2 * u1 * u1) / (2 * w0 * rho2 * u1);
  const b1 = (w1 * w1 - w0 * w0 - rho2 * rho2 * u1 * u1) / (2 * w1 * rho2 * u1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  const s = t * S;
  const w = Math.cosh(r0) / Math.cosh(r0 + rho * s);
  const u = w0 * ((Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / rho2) / u1;
  const scaleIncrement = 1 / w;
  const newZoom = startZoom + scaleToZoom(scaleIncrement);
  const newCenterWorld = vec2.scale([], uDelta, u);
  vec2.add(newCenterWorld, newCenterWorld, startCenterXY);
  vec2.scale(newCenterWorld, newCenterWorld, scaleIncrement);
  const newCenter = worldToLngLat(newCenterWorld, zoomToScale(newZoom));
  viewport.longitude = newCenter[0];
  viewport.latitude = newCenter[1];
  viewport.zoom = newZoom;
  return viewport;
}
//# sourceMappingURL=fly-to-viewport.js.map