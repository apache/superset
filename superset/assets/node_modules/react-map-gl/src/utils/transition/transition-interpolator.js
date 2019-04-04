// @flow
import {equals} from '../math-utils';
import assert from '../assert';

export default class TransitionInterpolator {

  propNames: Array<string> = [];

  /**
   * Checks if two sets of props need transition in between
   * @param currentProps {object} - a list of viewport props
   * @param nextProps {object} - a list of viewport props
   * @returns {bool} - true if two props are equivalent
   */
  arePropsEqual(currentProps: any, nextProps: any): boolean {
    for (const key of (this.propNames || [])) {
      if (!equals(currentProps[key], nextProps[key])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Called before transition starts to validate/pre-process start and end props
   * @param startProps {object} - a list of starting viewport props
   * @param endProps {object} - a list of target viewport props
   * @returns {Object} {start, end} - start and end props to be passed
   *   to `interpolateProps`
   */
  initializeProps(startProps: any, endProps: any): {
    start: any,
    end: any
  } {
    return {start: startProps, end: endProps};
  }

  /**
   * Returns viewport props in transition
   * @param startProps {object} - a list of starting viewport props
   * @param endProps {object} - a list of target viewport props
   * @param t {number} - a time factor between [0, 1]
   * @returns {object} - a list of interpolated viewport props
   */
  interpolateProps(startProps: any, endProps: any, t: number): any {
    assert(false, 'interpolateProps is not implemented');
  }

}
