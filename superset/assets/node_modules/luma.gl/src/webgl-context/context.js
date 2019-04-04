/* eslint-disable quotes */
// WebGLRenderingContext related methods
import {WebGLRenderingContext, WebGL2RenderingContext} from '../webgl-utils';
import {createHeadlessContext} from './create-headless-context';
import {getCanvas} from './create-canvas';
import {createBrowserContext} from './create-browser-context';
import trackContextState from './track-context-state';
import {makeDebugContext} from './debug-context';
import {glGetDebugInfo} from './context-limits';
import queryManager from '../webgl-utils/query-manager';

import {log, isBrowser} from '../utils';
import assert from '../utils/assert';

// Heuristic testing of contexts (to indentify debug wrappers around gl contexts)
const GL_ARRAY_BUFFER = 0x8892;
const GL_TEXTURE_BINDING_3D = 0x806A;

export const ERR_CONTEXT = 'Invalid WebGLRenderingContext';
export const ERR_WEBGL = ERR_CONTEXT;
export const ERR_WEBGL2 = 'Requires WebGL2';

export function isWebGL(gl) {
  return Boolean(gl && (
    gl instanceof WebGLRenderingContext ||
    gl.ARRAY_BUFFER === GL_ARRAY_BUFFER
  ));
}

export function isWebGL2(gl) {
  return Boolean(gl && (
    gl instanceof WebGL2RenderingContext ||
    gl.TEXTURE_BINDING_3D === GL_TEXTURE_BINDING_3D
  ));
}

export function assertWebGLContext(gl) {
  // Need to handle debug context
  assert(isWebGL(gl), ERR_CONTEXT);
}

export function assertWebGL2Context(gl) {
  // Need to handle debug context
  assert(isWebGL2(gl), ERR_WEBGL2);
}

const contextDefaults = {
  // COMMON CONTEXT PARAMETERS
  // Attempt to allocate WebGL2 context
  webgl2: true, // Attempt to create a WebGL2 context (false to force webgl1)
  webgl1: true,  // Attempt to create a WebGL1 context (false to fail if webgl2 not available)
  throwOnFailure: true,
  manageState: true,
  // BROWSER CONTEXT PARAMETERS
  canvas: null, // A canvas element or a canvas string id
  debug: false, // Instrument context (at the expense of performance)
  // HEADLESS CONTEXT PARAMETERS
  width: 800, // width are height are only used by headless gl
  height: 600
  // WEBGL/HEADLESS CONTEXT PARAMETERS
  // Remaining options are passed through to context creator
};

/*
 * Change default context creation parameters.
 * Main use case is regression test suite.
 */
export function setContextDefaults(opts = {}) {
  Object.assign(contextDefaults, {width: 1, height: 1}, opts);
}

/*
 * Creates a context giving access to the WebGL API
 */
/* eslint-disable complexity, max-statements */
export function createGLContext(opts = {}) {
  opts = Object.assign({}, contextDefaults, opts);
  const {canvas, width, height, throwOnError, manageState, debug} = opts;

  // Error reporting function, enables exceptions to be disabled
  function onError(message) {
    if (throwOnError) {
      throw new Error(message);
    }
    // log.log(0, message)();
    return null;
  }

  let gl;
  if (isBrowser) {
    // Get or create a canvas
    const targetCanvas = getCanvas({canvas, width, height, onError});
    // Create a WebGL context in the canvas
    gl = createBrowserContext({canvas: targetCanvas, opts});
  } else {
    // Create a headless-gl context under Node.js
    gl = createHeadlessContext({width, height, opts, onError});
  }
  if (!gl) {
    return null;
  }

  // Install context state tracking
  if (manageState) {
    trackContextState(gl, {
      copyState: false,
      log: (...args) => log.log(1, ...args)()
    });
  }

  // Add debug instrumentation to the context
  if (isBrowser && debug) {
    gl = makeDebugContext(gl, {debug});
    // Debug forces log level to at least 1
    log.priority = Math.max(log.priority, 1);
    // Log some debug info about the context
  }

  // Log context information
  logInfo(gl);

  // Add to seer integration
  return gl;
}

export function destroyGLContext(gl) {
  // TODO - Remove from seer integration

  // TODO - Unregister any tracking/polyfills

  // There is no way to delete browser based context

  // Destroy headless gl context
  const ext = gl.getExtension('STACKGL_destroy_context');
  if (ext) {
    ext.destroy();
  }
}

/**
 * Resize the canvas' drawing buffer.
 *
 * Can match the canvas CSS size, and optionally also consider devicePixelRatio
 * Can be called every frame
 *
 * Regardless of size, the drawing buffer will always be scaled to the viewport, but
 * for best visual results, usually set to either:
 *  canvas CSS width x canvas CSS height
 *  canvas CSS width * devicePixelRatio x canvas CSS height * devicePixelRatio
 * See http://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html
 *
 * resizeGLContext(gl, {width, height, useDevicePixels})
 */
export function resizeGLContext(gl, opts = {}) {
  // Resize browser context
  if (gl.canvas) {
    /* global window */
    const devicePixelRatio = opts.useDevicePixels ? window.devicePixelRatio || 1 : 1;

    const width = `width` in opts ? opts.width : gl.canvas.clientWidth;
    const height = `height` in opts ? opts.height : gl.canvas.clientHeight;

    gl.canvas.width = width * devicePixelRatio;
    gl.canvas.height = height * devicePixelRatio;

    return;
  }

  // Resize headless gl context
  const ext = gl.getExtension('STACKGL_resize_drawingbuffer');
  if (ext && `width` in opts && `height` in opts) {
    ext.resize(opts.width, opts.height);
  }
}

// POLLING FOR PENDING QUERIES
// Calling this function checks all pending queries for completion
export function pollGLContext(gl) {
  queryManager.poll(gl);
}

// HELPER METHODS

function logInfo(gl) {
  const webGL = isWebGL2(gl) ? 'WebGL2' : 'WebGL1';
  const info = glGetDebugInfo(gl);
  const driver = info ? `(${info.vendor},${info.renderer})` : '';
  const debug = gl.debug ? ' debug' : '';
  log.once(0, `${webGL}${debug} context ${driver}`)();
}
