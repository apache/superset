import {equals} from 'math.gl';
import assert from '../utils/assert';

export default class TransitionInterpolator {
  /**
   * @param opts {array|object}
   * @param opts.compare {array} - prop names used in equality check
   * @param opts.extract {array} - prop names needed for interpolation
   * @param opts.required {array} - prop names that must be supplied
   * alternatively, supply one list of prop names as `opts` if all of the above are the same.
   */
  constructor(opts = {}) {
    if (Array.isArray(opts)) {
      opts = {
        compare: opts,
        extract: opts,
        required: opts
      };
    }
    const {compare, extract, required} = opts;

    this._propsToCompare = compare;
    this._propsToExtract = extract;
    this._requiredProps = required;
  }

  /**
   * Checks if two sets of props need transition in between
   * @param currentProps {object} - a list of viewport props
   * @param nextProps {object} - a list of viewport props
   * @returns {bool} - true if two props are equivalent
   */
  arePropsEqual(currentProps, nextProps) {
    for (const key of this._propsToCompare || Object.keys(nextProps)) {
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
  initializeProps(startProps, endProps) {
    let result;

    if (this._propsToExtract) {
      const startViewStateProps = {};
      const endViewStateProps = {};

      for (const key of this._propsToExtract) {
        startViewStateProps[key] = startProps[key];
        endViewStateProps[key] = endProps[key];
      }
      result = {start: startViewStateProps, end: endViewStateProps};
    } else {
      result = {start: startProps, end: endProps};
    }

    this._checkRequiredProps(result.start);
    this._checkRequiredProps(result.end);

    return result;
  }

  /**
   * Returns viewport props in transition
   * @param startProps {object} - a list of starting viewport props
   * @param endProps {object} - a list of target viewport props
   * @param t {number} - a time factor between [0, 1]
   * @returns {object} - a list of interpolated viewport props
   */
  interpolateProps(startProps, endProps, t) {
    assert(false, 'interpolateProps is not implemented');
  }

  _checkRequiredProps(props) {
    if (!this._requiredProps) {
      return;
    }

    this._requiredProps.forEach(propName => {
      const value = props[propName];
      assert(
        Number.isFinite(value) || Array.isArray(value),
        `${propName} is required for transition`
      );
    });
  }
}
