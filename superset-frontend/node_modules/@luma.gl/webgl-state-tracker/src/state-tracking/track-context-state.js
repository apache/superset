// Support for listening to context state changes and intercepting state queries
//
// NOTE: this system does not handle buffer bindings
import GL_STATE_SETTERS from './webgl-function-to-parameters-table';
import {GL_PARAMETER_DEFAULTS} from '../unified-parameter-api/webgl-parameter-tables';
import {setParameters, getParameters} from '../unified-parameter-api/unified-parameter-api';
import {assert, deepArrayEqual} from '../utils';

// HELPER FUNCTIONS - INSTALL GET/SET INTERCEPTORS (SPYS) ON THE CONTEXT

// Overrides a WebGLRenderingContext state "getter" function
// to return values directly from cache
function installGetterOverride(gl, functionName) {
  // Get the original function from the WebGLRenderingContext
  const originalGetterFunc = gl[functionName].bind(gl);

  // Wrap it with a spy so that we can update our state cache when it gets called
  gl[functionName] = function get(...params) {
    const pname = params[0];

    // WebGL limits are not prepopulated in the cache, we must
    // query first time. They are all primitive (single value)
    if (!(pname in gl.state.cache)) {
      gl.state.cache[pname] = originalGetterFunc(...params);
    }

    // Optionally call the original function to do a "hard" query from the WebGLRenderingContext
    return gl.state.enable
      ? // Call the getter the params so that it can e.g. serve from a cache
        gl.state.cache[pname]
      : // Optionally call the original function to do a "hard" query from the WebGLRenderingContext
        originalGetterFunc(...params);
  };

  // Set the name of this anonymous function to help in debugging and profiling
  Object.defineProperty(gl[functionName], 'name', {
    value: `${functionName}-from-cache`,
    configurable: false
  });
}

// Overrides a WebGLRenderingContext state "setter" function
// to call a setter spy before the actual setter. Allows us to keep a cache
// updated with a copy of the WebGL context state.
function installSetterSpy(gl, functionName, setter) {
  // Get the original function from the WebGLRenderingContext
  const originalSetterFunc = gl[functionName].bind(gl);

  // Wrap it with a spy so that we can update our state cache when it gets called
  gl[functionName] = function set(...params) {
    // Update the value
    // Call the setter with the state cache and the params so that it can store the parameters
    const {valueChanged, oldValue} = setter(gl.state._updateCache, ...params);

    // Call the original WebGLRenderingContext func to make sure the context actually gets updated
    if (valueChanged) {
      gl.state.log(`gl.${functionName}`, ...params); // eslint-disable-line
      originalSetterFunc(...params);
    }

    // Note: if the original function fails to set the value, our state cache will be bad
    // No solution for this at the moment, but assuming that this is unlikely to be a real problem
    // We could call the setter after the originalSetterFunc. Concern is that this would
    // cause different behavior in debug mode, where originalSetterFunc can throw exceptions

    return oldValue;
  };

  // Set the name of this anonymous function to help in debugging and profiling
  Object.defineProperty(gl[functionName], 'name', {
    value: `${functionName}-to-cache`,
    configurable: false
  });
}

// HELPER CLASS - GLState

/* eslint-disable no-shadow */
class GLState {
  constructor(
    gl,
    {
      copyState = false, // Copy cache from params (slow) or initialize from WebGL defaults (fast)
      log = () => {} // Logging function, called when gl parameter change calls are actually issued
    } = {}
  ) {
    this.gl = gl;
    this.stateStack = [];
    this.enable = true;
    this.cache = copyState ? getParameters(gl) : Object.assign({}, GL_PARAMETER_DEFAULTS);
    this.log = log;

    this._updateCache = this._updateCache.bind(this);
    Object.seal(this);
  }

  push(values = {}) {
    this.stateStack.push({});
  }

  pop() {
    assert(this.stateStack.length > 0);
    // Use the saved values in the state stack to restore parameters
    const oldValues = this.stateStack[this.stateStack.length - 1];
    setParameters(this.gl, oldValues, this.cache);
    // Don't pop until we have reset parameters (to make sure other "stack frames" are not affected)
    this.stateStack.pop();
  }

  // interceptor for context set functions - update our cache and our stack
  // values (Object) - the key values for this setter
  _updateCache(values) {
    let valueChanged = false;
    let oldValue; // = undefined

    const oldValues = this.stateStack.length > 0 && this.stateStack[this.stateStack.length - 1];

    for (const key in values) {
      assert(key !== undefined);
      // Check that value hasn't already been shadowed
      if (!deepArrayEqual(values[key], this.cache[key])) {
        valueChanged = true;
        oldValue = this.cache[key];

        // First, save current value being shadowed
        // If a state stack frame is active, save the current parameter values for pop
        // but first check that value hasn't already been shadowed and saved
        if (oldValues && !(key in oldValues)) {
          oldValues[key] = this.cache[key];
        }

        // Save current value being shadowed
        this.cache[key] = values[key];
      }
    }

    return {valueChanged, oldValue};
  }
}

// PUBLIC API

/**
 * Initialize WebGL state caching on a context
 * can be called multiple times to enable/disable
 * @param {WebGLRenderingContext} - context
 */
// After calling this function, context state will be cached
// gl.state.push() and gl.state.pop() will be available for saving,
// temporarily modifying, and then restoring state.
export default function trackContextState(gl, {enable = true, copyState} = {}) {
  assert(copyState !== undefined);
  if (!gl.state) {
    /* global window, global */
    const global_ = typeof global !== 'undefined' ? global : window;
    if (global_.polyfillContext) {
      global_.polyfillContext(gl);
    }

    // Create a state cache
    gl.state = new GLState(gl, {copyState, enable});

    // intercept all setter functions in the table
    for (const key in GL_STATE_SETTERS) {
      const setter = GL_STATE_SETTERS[key];
      installSetterSpy(gl, key, setter);
    }

    // intercept all getter functions in the table
    installGetterOverride(gl, 'getParameter');
    installGetterOverride(gl, 'isEnabled');
  }

  gl.state.enable = enable;

  return gl;
}

export function pushContextState(gl) {
  if (!gl.state) {
    trackContextState(gl, {copyState: false});
  }
  gl.state.push();
}

export function popContextState(gl) {
  assert(gl.state);
  gl.state.pop();
}
