// @flow
import assert from '../assert';
import TransitionInterpolator from './transition-interpolator';

import {flyToViewport, getFlyToDuration} from 'viewport-mercator-project';
import {isValid, getEndValueByShortestPath} from './transition-utils';
import {lerp} from '../math-utils';

import type {MapStateProps} from '../map-state';

const VIEWPORT_TRANSITION_PROPS = ['longitude', 'latitude', 'zoom', 'bearing', 'pitch'];
const REQUIRED_PROPS = ['latitude', 'longitude', 'zoom', 'width', 'height'];
const LINEARLY_INTERPOLATED_PROPS = ['bearing', 'pitch'];
const DEFAULT_OPTS = {
  speed: 1.2,
  curve: 1.414
  // screenSpeed and maxDuration are used only if specified
};

type FlyToInterpolatorProps = {
  curve?: number,
  speed?: number,
  screenSpeed?: number,
  maxDuraiton?: number
};

/**
 * This class adapts mapbox-gl-js Map#flyTo animation so it can be used in
 * react/redux architecture.
 * mapbox-gl-js flyTo : https://www.mapbox.com/mapbox-gl-js/api/#map#flyto.
 * It implements “Smooth and efficient zooming and panning.” algorithm by
 * "Jarke J. van Wijk and Wim A.A. Nuij"
 */
export default class ViewportFlyToInterpolator extends TransitionInterpolator {
  speed: number;
  propNames = VIEWPORT_TRANSITION_PROPS;

  /**
   * @param props {Object}
   - `props.curve` (Number, optional, default: 1.414) - The zooming "curve" that will occur along the flight path.
   - `props.speed` (Number, optional, default: 1.2) - The average speed of the animation defined in relation to `options.curve`, it linearly affects the duration, higher speed returns smaller durations and vice versa.
   - `props.screenSpeed` (Number, optional) - The average speed of the animation measured in screenfuls per second. Similar to `opts.speed` it linearly affects the duration,  when specified `opts.speed` is ignored.
   - `props.maxDuration` (Number, optional) - Maximum duration in milliseconds, if calculated duration exceeds this value, `0` is returned.
   */
  constructor(props: FlyToInterpolatorProps = {}) {
    super();

    this.props = Object.assign({}, DEFAULT_OPTS, props);
  }

  props: FlyToInterpolatorProps;

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
    const viewport = flyToViewport(startProps, endProps, t, this.props);

    // Linearly interpolate 'bearing' and 'pitch' if exist.
    for (const key of LINEARLY_INTERPOLATED_PROPS) {
      viewport[key] = lerp(startProps[key], endProps[key], t);
    }

    return viewport;
  }

  // computes the transition duration
  getDuration(startProps: MapStateProps, endProps: MapStateProps) {
    let {transitionDuration} = endProps;
    if (transitionDuration === 'auto') {
      // auto calculate duration based on start and end props
      transitionDuration = getFlyToDuration(startProps, endProps, this.props);
    }
    return transitionDuration;
  }
}
