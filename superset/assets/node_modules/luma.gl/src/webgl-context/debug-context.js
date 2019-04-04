// Depends on Khronos Debug support module being imported via "luma.gl/debug"

import {global} from '../utils/globals';
import {log} from '../utils';

// Helper to get shared context data
function getContextData(gl) {
  gl.luma = gl.luma || {};
  return gl.luma;
}

// Enable or disable debug checks in debug contexts
// Non-debug contexts do not have checks (to ensure performance)
// Turning off debug for debug contexts removes most of the performance penalty
export function enableDebug(debug) {
  log.debug = debug;
}

// Returns (a potentially new) context with debug instrumentation turned off or on.
// Note that this actually returns a new context
export function makeDebugContext(gl, {debug = true} = {}) {
  if (gl === null) { // Return to ensure we don't create a context in this case.
    return null;
  }

  return debug ? getDebugContext(gl) : getRealContext(gl);
}

// Returns the real context from either of the real/debug contexts
export function getRealContext(gl) {
  if (gl === null) { // Return to ensure we don't create a context in this case.
    return null;
  }

  const data = getContextData(gl);
  // If the context has a realContext member, it is a debug context so return the realContext
  return data.realContext ? data.realContext : gl;
}

// Returns the debug context from either of the real/debug contexts
export function getDebugContext(gl) {
  if (gl === null) { // Return to ensure we don't create a context in this case.
    return null;
  }

  if (!global.WebGLDebug) {
    log.warn('WebGL debug mode activation failed. import "luma.gl/debug" to enable.')();
    return gl;
  }

  const data = getContextData(gl);
  // If this *is* a debug context, return itself
  if (data.realContext) {
    return gl;
  }

  // If this already has a debug context, return it.
  if (data.debugContext) {
    return data.debugContext;
  }

  // Create a new debug context
  class WebGLDebugContext {}
  const debugContext = global.WebGLDebug.makeDebugContext(gl, onGLError, onValidateGLFunc);
  Object.assign(WebGLDebugContext.prototype, debugContext);

  // Store the debug context
  data.debugContext = debugContext;
  debugContext.debug = true;
  debugContext.gl = gl;

  log.info('debug context actived.');

  // Return it
  return debugContext;
}

// DEBUG TRACING

function getFunctionString(functionName, functionArgs) {
  let args = global.WebGLDebug.glFunctionArgsToString(functionName, functionArgs);
  args = `${args.slice(0, 100)}${args.length > 100 ? '...' : ''}`;
  return `gl.${functionName}(${args})`;
}

function onGLError(err, functionName, args) {
  const errorMessage = global.WebGLDebug.glEnumToString(err);
  const functionArgs = global.WebGLDebug.glFunctionArgsToString(functionName, args);
  const message = `${errorMessage} in gl.${functionName}(${functionArgs})`;
  if (log.throw) {
    throw new Error(message);
  } else {
    log.error(message)();
    debugger; // eslint-disable-line
  }
}

// Don't generate function string until it is needed
function onValidateGLFunc(functionName, functionArgs) {
  let functionString;
  if (log.priority >= 4) {
    functionString = getFunctionString(functionName, functionArgs);
    log.info(4, functionString)();
  }

  if (log.break) {
    functionString = functionString || getFunctionString(functionName, functionArgs);
    const isBreakpoint = log.break &&
      log.break.every(breakOn => functionString.indexOf(breakOn) !== -1);
    if (isBreakpoint) {
      debugger; // eslint-disable-line
    }
  }

  for (const arg of functionArgs) {
    if (arg === undefined) {
      functionString = functionString || getFunctionString(functionName, functionArgs);
      if (log.throw) {
        throw new Error(`Undefined argument: ${functionString}`);
      } else {
        log.error(`Undefined argument: ${functionString}`);
        debugger; // eslint-disable-line
      }
    }
  }
}
