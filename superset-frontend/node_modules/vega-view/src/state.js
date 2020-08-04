import {transforms} from 'vega-dataflow';
import {isArray} from 'vega-util';

/**
 * Get the current view state, consisting of signal values and/or data sets.
 * @param {object} [options] - Options flags indicating which state to export.
 *   If unspecified, all signals and data sets will be exported.
 * @param {function(string, Operator):boolean} [options.signals] - Optional
 *   predicate function for testing if a signal should be included in the
 *   exported state. If unspecified, all signals will be included, except for
 *   those named 'parent' or those which refer to a Transform value.
 * @param {function(string, object):boolean} [options.data] - Optional
 *   predicate function for testing if a data set's input should be included
 *   in the exported state. If unspecified, all data sets that have been
 *   explicitly modified will be included.
 * @param {boolean} [options.recurse=true] - Flag indicating if the exported
 *   state should recursively include state from group mark sub-contexts.
 * @return {object} - An object containing the exported state values.
 */
export function getState(options) {
  return this._runtime.getState(options || {
    data:    dataTest,
    signals: signalTest,
    recurse: true
  });
}

function dataTest(name, data) {
  return data.modified
      && isArray(data.input.value)
      && name.indexOf('_:vega:_');
}

function signalTest(name, op) {
  return !(name === 'parent' || op instanceof transforms.proxy);
}

/**
 * Sets the current view state and updates the view by invoking run.
 * @param {object} state - A state object containing signal and/or
 *   data set values, following the format used by the getState method.
 * @return {View} - This view instance.
 */
export function setState(state) {
  this.runAsync(null,
    v => { v._trigger = false; v._runtime.setState(state); },
    v => { v._trigger = true; }
  );
  return this;
}
