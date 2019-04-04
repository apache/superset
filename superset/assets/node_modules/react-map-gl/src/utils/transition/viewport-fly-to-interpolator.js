// @flow
import assert from '../assert';
import TransitionInterpolator from './transition-interpolator';

import {flyToViewport} from 'viewport-mercator-project';
import {isValid, getEndValueByShortestPath} from './transition-utils';
import {lerp} from '../math-utils';

import type {MapStateProps} from '../map-state';

const VIEWPORT_TRANSITION_PROPS = ['longitude', 'latitude', 'zoom', 'bearing', 'pitch'];
const REQUIRED_PROPS = ['latitude', 'longitude', 'zoom', 'width', 'height'];
const LINEARLY_INTERPOLATED_PROPS = ['bearing', 'pitch'];

/**
 * This class adapts mapbox-gl-js Map#flyTo animation so it can be used in
 * react/redux architecture.
 * mapbox-gl-js flyTo : https://www.mapbox.com/mapbox-gl-js/api/#map#flyto.
 * It implements “Smooth and efficient zooming and panning.” algorithm by
 * "Jarke J. van Wijk and Wim A.A. Nuij"
*/
export default class ViewportFlyToInterpolator extends TransitionInterpolator {

  propNames = VIEWPORT_TRANSITION_PROPS;

  initializeProps(startProps: MapStateProps, endProps: MapStateProps) {
    const startViewportProps = {};
    const endViewportProps = {};

    // Check minimum required props
    for (const key of REQUIRED_PROPS) {
      const startValue = startProps[key];
      const endValue = endProps[key];
      assert(isValid(startValue) && isValid(endValue), `${key} must be supplied for transition`);
      startViewportProps[key] = startValue;
      endViewportProps[key] = getEndValueByShortestPath(key, startValue, endValue);
    }

    for (const key of LINEARLY_INTERPOLATED_PROPS) {
      const startValue = startProps[key] || 0;
      const endValue = endProps[key] || 0;
      startViewportProps[key] = startValue;
      endViewportProps[key] = getEndValueByShortestPath(key, startValue, endValue);
    }

    return {
      start: startViewportProps,
      end: endViewportProps
    };
  }

  interpolateProps(startProps: MapStateProps, endProps: MapStateProps, t: number) {
    const viewport = flyToViewport(startProps, endProps, t);

    // Linearly interpolate 'bearing' and 'pitch' if exist.
    for (const key of LINEARLY_INTERPOLATED_PROPS) {
      viewport[key] = lerp(startProps[key], endProps[key], t);
    }

    return viewport;
  }

}
