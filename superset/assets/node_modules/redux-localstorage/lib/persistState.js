'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports['default'] = persistState;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _createSlicerJs = require('./createSlicer.js');

var _createSlicerJs2 = _interopRequireDefault(_createSlicerJs);

var _utilMergeStateJs = require('./util/mergeState.js');

var _utilMergeStateJs2 = _interopRequireDefault(_utilMergeStateJs);

/**
 * @description
 * persistState is a Store Enhancer that syncs (a subset of) store state to localStorage.
 *
 * @param {String|String[]} [paths] Specify keys to sync with localStorage, if left undefined the whole store is persisted
 * @param {Object} [config] Optional config object
 * @param {String} [config.key="redux"] String used as localStorage key
 * @param {Function} [config.slicer] (paths) => (state) => subset. A function that returns a subset
 * of store state that should be persisted to localStorage
 * @param {Function} [config.serialize=JSON.stringify] (subset) => serializedData. Called just before persisting to
 * localStorage. Should transform the subset into a format that can be stored.
 * @param {Function} [config.deserialize=JSON.parse] (persistedData) => subset. Called directly after retrieving
 * persistedState from localStorage. Should transform the data into the format expected by your application
 *
 * @return {Function} An enhanced store
 */

function persistState(paths, config) {
  var cfg = _extends({
    key: 'redux',
    merge: _utilMergeStateJs2['default'],
    slicer: _createSlicerJs2['default'],
    serialize: JSON.stringify,
    deserialize: JSON.parse
  }, config);

  var key = cfg.key;
  var merge = cfg.merge;
  var slicer = cfg.slicer;
  var serialize = cfg.serialize;
  var deserialize = cfg.deserialize;

  return function (next) {
    return function (reducer, initialState, enhancer) {
      if (typeof initialState === 'function' && typeof enhancer === 'undefined') {
        enhancer = initialState;
        initialState = undefined;
      }

      var persistedState = undefined;
      var finalInitialState = undefined;

      try {
        persistedState = deserialize(localStorage.getItem(key));
        finalInitialState = merge(initialState, persistedState);
      } catch (e) {
        console.warn('Failed to retrieve initialize state from localStorage:', e);
      }

      var store = next(reducer, finalInitialState, enhancer);
      var slicerFn = slicer(paths);

      store.subscribe(function () {
        var state = store.getState();
        var subset = slicerFn(state);

        try {
          localStorage.setItem(key, serialize(subset));
        } catch (e) {
          console.warn('Unable to persist state to localStorage:', e);
        }
      });

      return store;
    };
  };
}

module.exports = exports['default'];