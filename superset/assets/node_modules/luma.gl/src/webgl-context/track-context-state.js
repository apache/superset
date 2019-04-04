// Support for listening to context state changes and intercepting state queries
//
// NOTE: this system does not handle buffer bindings
import GL from '../constants';
import {setParameters, getParameters, GL_PARAMETER_DEFAULTS} from './set-parameters';
import polyfillContext from './polyfill-context';
import assert from '../utils/assert';

export const clone = x => {
  return Array.isArray(x) || ArrayBuffer.isView(x) ? x.slice() : x;
};

export const deepEqual = (x, y) => {
  const isArrayX = Array.isArray(x) || ArrayBuffer.isView(x);
  const isArrayY = Array.isArray(y) || ArrayBuffer.isView(y);
  if (isArrayX && isArrayY && x.length === y.length) {
    for (let i = 0; i < x.length; ++i) {
      if (x[i] !== y[i]) {
        return false;
      }
    }
    return true;
  }
  return x === y;
};

// interceptors for WEBGL FUNCTIONS that set WebGLRenderingContext state
// These "setters" map functions to gl parameters

export const GL_STATE_SETTERS = {

  // GENERIC SETTERS

  enable: (update, cap) => update({
    [cap]: true
  }),
  disable: (update, cap) => update({
    [cap]: false}
  ),
  pixelStorei: (update, pname, param) => update({
    [pname]: param
  }),
  hint: (update, pname, hint) => update({
    [pname]: hint
  }),

  // SPECIFIC SETTERS

  bindFramebuffer: (update, target, fb) => {
    switch (target) {
    case GL.FRAMEBUFFER:
      return update({
        [GL.DRAW_FRAMEBUFFER_BINDING]: fb,
        [GL.READ_FRAMEBUFFER_BINDING]: fb
      });
    case GL.DRAW_FRAMEBUFFER:
      return update({[GL.DRAW_FRAMEBUFFER_BINDING]: fb});
    case GL.READ_FRAMEBUFFER:
      return update({[GL.READ_FRAMEBUFFER_BINDING]: fb});
    default:
      return null;
    }
  },
  blendColor: (update, r, g, b, a) => update({
    [GL.BLEND_COLOR]: new Float32Array([r, g, b, a])}
  ),

  blendEquation: (update, mode) => update({
    [GL.BLEND_EQUATION_RGB]: mode,
    [GL.BLEND_EQUATION_ALPHA]: mode
  }),

  blendEquationSeparate: (update, modeRGB, modeAlpha) => update({
    [GL.BLEND_EQUATION_RGB]: modeRGB,
    [GL.BLEND_EQUATION_ALPHA]: modeAlpha
  }),

  blendFunc: (update, src, dst) => update({
    [GL.BLEND_SRC_RGB]: src,
    [GL.BLEND_DST_RGB]: dst,
    [GL.BLEND_SRC_ALPHA]: src,
    [GL.BLEND_DST_ALPHA]: dst
  }),

  blendFuncSeparate: (update, srcRGB, dstRGB, srcAlpha, dstAlpha) => update({
    [GL.BLEND_SRC_RGB]: srcRGB,
    [GL.BLEND_DST_RGB]: dstRGB,
    [GL.BLEND_SRC_ALPHA]: srcAlpha,
    [GL.BLEND_DST_ALPHA]: dstAlpha
  }),

  clearColor: (update, r, g, b, a) => update({
    [GL.COLOR_CLEAR_VALUE]: new Float32Array([r, g, b, a])
  }),

  clearDepth: (update, depth) => update({
    [GL.DEPTH_CLEAR_VALUE]: depth
  }),

  clearStencil: (update, s) => update({
    [GL.STENCIL_CLEAR_VALUE]: s
  }),

  colorMask: (update, r, g, b, a) => update({
    [GL.COLOR_WRITEMASK]: [r, g, b, a]
  }),

  cullFace: (update, mode) => update({
    [GL.CULL_FACE_MODE]: mode
  }),

  depthFunc: (update, func) => update({
    [GL.DEPTH_FUNC]: func
  }),

  depthRange: (update, zNear, zFar) => update({
    [GL.DEPTH_RANGE]: new Float32Array([zNear, zFar])
  }),

  depthMask: (update, mask) => update({
    [GL.DEPTH_WRITEMASK]: mask
  }),

  frontFace: (update, face) => update({
    [GL.FRONT_FACE]: face
  }),

  lineWidth: (update, width) => update({
    [GL.LINE_WIDTH]: width
  }),

  polygonOffset: (update, factor, units) => update({
    [GL.POLYGON_OFFSET_FACTOR]: factor,
    [GL.POLYGON_OFFSET_UNITS]: units
  }),

  sampleCoverage: (update, value, invert) => update({
    [GL.SAMPLE_COVERAGE_VALUE]: value,
    [GL.SAMPLE_COVERAGE_INVERT]: invert
  }),

  scissor: (update, x, y, width, height) => update({
    [GL.SCISSOR_BOX]: new Int32Array([x, y, width, height])
  }),

  stencilMask: (update, mask) => update({
    [GL.STENCIL_WRITEMASK]: mask,
    [GL.STENCIL_BACK_WRITEMASK]: mask
  }),

  stencilMaskSeparate: (update, face, mask) => update({
    [face === GL.FRONT ? GL.STENCIL_WRITEMASK : GL.STENCIL_BACK_WRITEMASK]: mask
  }),

  stencilFunc: (update, func, ref, mask) => update({
    [GL.STENCIL_FUNC]: func,
    [GL.STENCIL_REF]: ref,
    [GL.STENCIL_VALUE_MASK]: mask,
    [GL.STENCIL_BACK_FUNC]: func,
    [GL.STENCIL_BACK_REF]: ref,
    [GL.STENCIL_BACK_VALUE_MASK]: mask
  }),

  stencilFuncSeparate: (update, face, func, ref, mask) => update({
    [face === GL.FRONT ? GL.STENCIL_FUNC : GL.STENCIL_BACK_FUNC]: func,
    [face === GL.FRONT ? GL.STENCIL_REF : GL.STENCIL_BACK_REF]: ref,
    [face === GL.FRONT ? GL.STENCIL_VALUE_MASK : GL.STENCIL_BACK_VALUE_MASK]: mask
  }),

  stencilOp: (update, fail, zfail, zpass) => update({
    [GL.STENCIL_FAIL]: fail,
    [GL.STENCIL_PASS_DEPTH_FAIL]: zfail,
    [GL.STENCIL_PASS_DEPTH_PASS]: zpass,
    [GL.STENCIL_BACK_FAIL]: fail,
    [GL.STENCIL_BACK_PASS_DEPTH_FAIL]: zfail,
    [GL.STENCIL_BACK_PASS_DEPTH_PASS]: zpass
  }),

  stencilOpSeparate: (update, face, fail, zfail, zpass) => update({
    [face === GL.FRONT ? GL.STENCIL_FAIL : GL.STENCIL_BACK_FAIL]: fail,
    [face === GL.FRONT ? GL.STENCIL_PASS_DEPTH_FAIL : GL.STENCIL_BACK_PASS_DEPTH_FAIL]: zfail,
    [face === GL.FRONT ? GL.STENCIL_PASS_DEPTH_PASS : GL.STENCIL_BACK_PASS_DEPTH_PASS]: zpass
  }),

  viewport: (update, x, y, width, height) => update({
    [GL.VIEWPORT]: new Int32Array([x, y, width, height])
  })
};

// HELPER FUNCTIONS - INSTALL GET/SET INTERCEPTORS (SPYS) ON THE CONTEXT

// Overrides a WebGLRenderingContext state "getter" function
// to return values directly from cache
function installGetterOverride(gl, functionName) {
  // Get the original function from the WebGLRenderingContext
  const originalGetterFunc = gl[functionName].bind(gl);

  // Wrap it with a spy so that we can update our state cache when it gets called
  gl[functionName] = function(...params) {
    const pname = params[0];

    // WebGL limits are not prepopulated in the cache, we must
    // query first time. They are all primitive (single value)
    if (!(pname in gl.state.cache)) {
      gl.state.cache[pname] = originalGetterFunc(...params);
    }

    // Optionally call the original function to do a "hard" query from the WebGLRenderingContext
    return gl.state.enable ?
      // Call the getter the params so that it can e.g. serve from a cache
      gl.state.cache[pname] :
      // Optionally call the original function to do a "hard" query from the WebGLRenderingContext
      originalGetterFunc(...params);
  };

  // Set the name of this anonymous function to help in debugging and profiling
  Object.defineProperty(
    gl[functionName], 'name', {value: `${functionName}-from-cache`, configurable: false});
}

// Overrides a WebGLRenderingContext state "setter" function
// to call a setter spy before the actual setter. Allows us to keep a cache
// updated with a copy of the WebGL context state.
function installSetterSpy(gl, functionName, setter) {
  // Get the original function from the WebGLRenderingContext
  const originalSetterFunc = gl[functionName].bind(gl);

  // Wrap it with a spy so that we can update our state cache when it gets called
  gl[functionName] = function(...params) {
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
  Object.defineProperty(
    gl[functionName], 'name', {value: `${functionName}-to-cache`, configurable: false});
}

// HELPER CLASS - GLState

/* eslint-disable no-shadow */
class GLState {
  constructor(gl, {
    copyState = false, // Copy cache from params (slow) or initialize from WebGL defaults (fast)
    log = () => {} // Logging function, called when gl parameter change calls are actually issued
  } = {}) {
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
      if (!deepEqual(values[key], this.cache[key])) {
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
    polyfillContext(gl);

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
