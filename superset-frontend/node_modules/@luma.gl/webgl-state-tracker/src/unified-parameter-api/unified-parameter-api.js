// Provides a unified API for getting and setting any WebGL parameter
// Also knows default values of all parameters, enabling fast cache initialization
// Provides base functionality for the state caching.
import {
  GL_PARAMETER_DEFAULTS,
  GL_PARAMETER_SETTERS,
  GL_COMPOSITE_PARAMETER_SETTERS,
  GL_PARAMETER_GETTERS
} from './webgl-parameter-tables';

import deepArrayEqual from '../utils/deep-array-equal';
import {assert} from '../utils';

// PUBLIC METHODS

// Sets any single GL parameter regardless of function (gl.getParameter/gl.isEnabled...)
// Returns the previous value
// Note: limited to parameter values
export function setParameter(gl, key, value) {
  const getter = GL_PARAMETER_GETTERS[key];
  const prevValue = getter ? getter(gl, Number(key)) : gl.getParameter(Number(key));
  const setter = GL_PARAMETER_SETTERS[key];
  assert(typeof setter === 'function');
  setter(gl, value, Number(key));
  return prevValue;
}

// Sets any GL parameter regardless of function (gl.blendMode, ...)
// Note: requires a `cache` object to be set on the context (gl.state.cache)
// This object is used to fill in any missing values for composite setter functions
export function setParameters(gl, values) {
  const compositeSetters = {};

  // HANDLE PRIMITIVE SETTERS (and make note of any composite setters)

  for (const key in values) {
    const glConstant = Number(key);
    const setter = GL_PARAMETER_SETTERS[key];
    if (setter) {
      // Composite setters should only be called once, so save them
      if (typeof setter === 'string') {
        compositeSetters[setter] = true;
      } else {
        // if (gl[glConstant] !== undefined) {
        // TODO - added above check since this is being called on WebGL2 values in WebGL1...
        // TODO - deep equal on values? only call setter if value has changed?
        // NOTE - the setter will automatically update this.state
        setter(gl, values[key], glConstant);
      }
    }
  }

  // HANDLE COMPOSITE SETTERS

  // NOTE: any non-provided values needed by composite setters are filled in from state cache
  // The cache parameter is automatically retrieved from the context
  // This depends on `trackContextState`, which is technically a "circular" dependency.
  // But it is too inconvenient to always require a cache parameter here.
  // This is the ONLY external dependency in this module/
  const cache = gl.state && gl.state.cache;
  if (cache) {
    const mergedValues = Object.assign({}, cache, values);

    for (const key in compositeSetters) {
      // TODO - avoid calling composite setters if values have not changed.
      const compositeSetter = GL_COMPOSITE_PARAMETER_SETTERS[key];
      // Note - if `trackContextState` has been called,
      // the setter will automatically update this.state.cache
      compositeSetter(gl, mergedValues);
    }
  }
  // Add a log for the else case?
}

// Queries any single GL parameter regardless of function (gl.getParameter/gl.isEnabled...)
export function getParameter(gl, key) {
  const getter = GL_PARAMETER_GETTERS[key];
  return getter ? getter(gl, Number(key)) : gl.getParameter(Number(key));
}

// Copies the state from a context (gl.getParameter should not be overriden)
// Reads the entire WebGL state from a context
// Caveat: This generates a huge amount of synchronous driver roundtrips and should be
// considered a very slow operation, to be used only if/when a context already manipulated
// by external code needs to be synchronized for the first time
// @return {Object} - a newly created map, with values keyed by GL parameters
export function getParameters(gl, parameters) {
  // default to querying all parameters
  parameters = parameters || GL_PARAMETER_DEFAULTS;
  // support both arrays of parameters and objects (keys represent parameters)
  const parameterKeys = Array.isArray(parameters) ? parameters : Object.keys(parameters);

  const state = {};
  for (const key of parameterKeys) {
    state[key] = getParameter(gl, key);
  }
  return state;
}

export function getDefaultParameters(gl) {
  // TODO - Query GL.VIEWPORT and GL.SCISSOR_BOX since these are dynamic
  return Object.assign({}, GL_PARAMETER_DEFAULTS, {
    // TODO: For viewport and scissor default values are set at the time of
    // context creation based on canvas size, we can query them here but it will
    // not match with what we have in GL_PARAMETER_DEFAULTS table, we should revisit.
    // [GL.VIEWPORT]: gl.constructor.prototype.getParameter.call(gl, GL.VIEWPORT),
    // [GL.SCISSOR_BOX]: gl.constructor.prototype.getParameter.call(gl, GL.SCISSOR_BOX)
  });
}

// Reset all parameters to a pure context state
export function resetParameters(gl) {
  setParameters(gl, getDefaultParameters(gl));
}

// Get all parameters that have been modified from a pure context state
export function getModifiedParameters(gl) {
  const values = getParameters(gl, Object.keys(GL_PARAMETER_DEFAULTS));
  const modified = {};
  for (const key in GL_PARAMETER_DEFAULTS) {
    if (!deepArrayEqual(values[key], GL_PARAMETER_DEFAULTS[key])) {
      modified[key] = values[key];
    }
  }
  return modified;
}
