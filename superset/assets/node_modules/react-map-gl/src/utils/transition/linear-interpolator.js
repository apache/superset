// @flow
import WebMercatorViewport from 'viewport-mercator-project';

import assert from '../assert';
import TransitionInterpolator from './transition-interpolator';

import {isValid, getEndValueByShortestPath} from './transition-utils';
import {lerp} from '../math-utils';

import type {MapStateProps} from '../map-state';

const VIEWPORT_TRANSITION_PROPS = ['longitude', 'latitude', 'zoom', 'bearing', 'pitch'];

type TransitionProps = MapStateProps & {
  around: Array<number>,
  aroundLngLat: Array<number>
};

/**
 * Performs linear interpolation of two viewports.
*/
export default class LinearInterpolator extends TransitionInterpolator {

  /**
   * @param opts {Object}
   *  - opts.transitionProps {Array}] - list of props to apply linear transition to.
   *  - opts.around {Array} - a screen point to zoom/rotate around
   */
  constructor(opts: {
    transitionProps?: Array<string>,
    around?: Array<number>
  } = {}) {
    super();

    if (Array.isArray(opts)) {
      // backward compatibility
      opts = {transitionProps: opts};
    }

    this.propNames = opts.transitionProps || VIEWPORT_TRANSITION_PROPS;
    if (opts.around) {
      this.around = opts.around;
    }
  }

  around: Array<number>;

  initializeProps(startProps: MapStateProps, endProps: MapStateProps) {
    const startViewportProps = {};
    const endViewportProps = {};

    if (this.around) {
      // anchor point in origin screen coordinates
      startViewportProps.around = this.around;
      // anchor point in spherical coordinates
      const aroundLngLat = new WebMercatorViewport(startProps).unproject(this.around);
      Object.assign(endViewportProps, endProps, {
        // anchor point in destination screen coordinates
        around: new WebMercatorViewport(endProps).project(aroundLngLat),
        aroundLngLat
      });
    }

    for (const key of this.propNames) {
      const startValue = startProps[key];
      const endValue = endProps[key];
      assert(isValid(startValue) && isValid(endValue), `${key} must be supplied for transition`);

      startViewportProps[key] = startValue;
      endViewportProps[key] = getEndValueByShortestPath(key, startValue, endValue);
    }

    return {
      start: startViewportProps,
      end: endViewportProps
    };
  }

  interpolateProps(startProps: TransitionProps, endProps: TransitionProps, t: number) {
    const viewport = {};
    for (const key of this.propNames) {
      viewport[key] = lerp(startProps[key], endProps[key], t);
    }

    if (endProps.around) {
      // zoom around provided point
      const [longitude, latitude] = new WebMercatorViewport(Object.assign({}, endProps, viewport))
        .getMapCenterByLngLatPosition({
          lngLat: endProps.aroundLngLat,
          // anchor point in current screen coordinates
          pos: lerp(startProps.around, endProps.around, t)
        });
      viewport.longitude = longitude;
      viewport.latitude = latitude;
    }

    return viewport;
  }

}
