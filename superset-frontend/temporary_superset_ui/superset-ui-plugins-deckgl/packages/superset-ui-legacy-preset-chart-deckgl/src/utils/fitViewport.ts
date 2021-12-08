import { fitBounds } from '@math.gl/web-mercator';
import computeBoundsFromPoints from './computeBoundsFromPoints';
import { Point } from './types';

type Viewport = {
  longtitude: number;
  latitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
};

type FitViewportOptions = {
  points: Point[];
  width: number;
  height: number;
  minExtent?: number;
  maxZoom?: number;
  offset?: [number, number];
  padding?: number;
};

export default function fitViewport(
  originalViewPort: Viewport,
  { points, width, height, minExtent, maxZoom, offset, padding = 20 }: FitViewportOptions,
) {
  const { bearing, pitch } = originalViewPort;
  const bounds = computeBoundsFromPoints(points);

  try {
    return {
      ...fitBounds({
        bounds,
        width,
        height,
        minExtent,
        maxZoom,
        offset,
        padding,
      }),
      bearing,
      pitch,
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not fit viewport', error);
  }

  return originalViewPort;
}
