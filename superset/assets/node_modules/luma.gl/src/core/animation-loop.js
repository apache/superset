import {createGLContext, resizeGLContext, resetParameters} from '../webgl-context';
import {pageLoadPromise} from '../webgl-context';
import {makeDebugContext} from '../webgl-context/debug-context';
import {isWebGL, requestAnimationFrame, cancelAnimationFrame} from '../webgl-utils';
import {log} from '../utils';
import assert from '../utils/assert';

// TODO - remove dependency on webgl classes
import {Framebuffer} from '../webgl';

const DEFAULT_GL_OPTIONS = {
  preserveDrawingBuffer: true
};

export default class AnimationLoop {
  /*
   * @param {HTMLCanvasElement} canvas - if provided, width and height will be passed to context
   */
  constructor(props = {}) {
    const {
      onCreateContext = opts => createGLContext(opts),
      onInitialize = () => {},
      onRender = () => {},
      onFinalize = () => {},

      offScreen = false,
      gl = null,
      glOptions = {},
      debug = false,

      createFramebuffer = false,

      // view parameters
      autoResizeViewport = true,
      autoResizeDrawingBuffer = true
    } = props;

    let {
      useDevicePixels = true
    } = props;

    if ('useDevicePixelRatio' in props) {
      log.deprecated('useDevicePixelRatio', 'useDevicePixels')();
      useDevicePixels = props.useDevicePixelRatio;
    }

    this.props = {
      onCreateContext,
      onInitialize,
      onRender,
      onFinalize,

      gl,
      glOptions,
      debug,
      createFramebuffer
    };

    // state
    this.gl = gl;
    this.offScreen = offScreen;
    this.needsRedraw = null;

    this.setProps({
      autoResizeViewport,
      autoResizeDrawingBuffer,
      useDevicePixels
    });

    // Bind methods
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this._renderFrame = this._renderFrame.bind(this);

    return this;
  }

  setNeedsRedraw(reason) {
    assert(typeof reason === 'string');
    this.needsRedraw = this.needsRedraw || reason;
    return this;
  }

  setProps(props) {
    if ('autoResizeViewport' in props) {
      this.autoResizeViewport = props.autoResizeViewport;
    }
    if ('autoResizeDrawingBuffer' in props) {
      this.autoResizeDrawingBuffer = props.autoResizeDrawingBuffer;
    }
    if ('useDevicePixels' in props) {
      this.useDevicePixels = props.useDevicePixels;
    }
    return this;
  }

  // Starts a render loop if not already running
  // @param {Object} context - contains frame specific info (E.g. tick, width, height, etc)
  start(opts = {}) {
    this._stopped = false;
    // console.debug(`Starting ${this.constructor.name}`);
    if (!this._animationFrameId) {
      // Wait for start promise before rendering frame
      this._startPromise = pageLoadPromise
      .then(() => {
        if (this._stopped) {
          return null;
        }

        // Create the WebGL context
        this._createWebGLContext(opts);
        this._createFramebuffer();

        // Initialize the callback data
        this._initializeCallbackData();
        this._updateCallbackData();

        // Default viewport setup, in case onInitialize wants to render
        this._resizeCanvasDrawingBuffer();
        this._resizeViewport();

        // Note: onIntialize can return a promise (in case it needs to load resources)
        return this.props.onInitialize(this._callbackData);
      })
      .then(appContext => {
        if (!this._stopped) {
          this._addCallbackData(appContext || {});
          if (appContext !== false && !this._animationFrameId) {
            this._animationFrameId = requestAnimationFrame(this._renderFrame);
          }
        }
      });

    }
    return this;
  }

  // Stops a render loop if already running, finalizing
  stop() {
    // console.debug(`Stopping ${this.constructor.name}`);
    if (this._animationFrameId) {
      this._finalizeCallbackData();
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
      this._stopped = true;
    }
    return this;
  }

  // DEPRECATED METHODS

  // Update parameters
  setViewParameters({
    autoResizeDrawingBuffer = true,
    autoResizeCanvas = true,
    autoResizeViewport = true,
    useDevicePixels = true,
    useDevicePixelRatio = null // deprecated
  }) {
    log.deprecated('AnimationLoop.setViewParameters', 'AnimationLoop.setProps')();
    this.autoResizeViewport = autoResizeViewport;
    this.autoResizeCanvas = autoResizeCanvas;
    this.autoResizeDrawingBuffer = autoResizeDrawingBuffer;
    this.useDevicePixels = useDevicePixels;
    if (useDevicePixelRatio !== null) {
      log.deprecated('useDevicePixelRatio', 'useDevicePixels')();
      this.useDevicePixels = useDevicePixelRatio;
    }
    return this;
  }

  // PRIVATE METHODS

  _setupFrame() {
    if (this._onSetupFrame) {
      // call callback
      this._onSetupFrame(this._callbackData);
      // end callback
    } else {
      this._resizeCanvasDrawingBuffer();
      this._resizeViewport();
      this._resizeFramebuffer();
    }
  }

  /**
   * @private
   * Handles a render loop frame - updates context and calls the application
   * callback
   */
  _renderFrame() {
    if (this._stopped) {
      return;
    }

    this._setupFrame();
    this._updateCallbackData();

    // call callback
    this.props.onRender(this._callbackData);
    // end callback

    if (this.offScreen) {
      // commit returns a Promise
      this.gl.commit().then(this._renderFrame);
    } else {
      // Request another render frame (now )
      this._animationFrameId = requestAnimationFrame(this._renderFrame);
    }
  }

  // Initialize the  object that will be passed to app callbacks
  _initializeCallbackData() {
    this._callbackData = {
      gl: this.gl,
      canvas: this.gl.canvas,
      framebuffer: this.framebuffer,
      stop: this.stop,
      // Initial values
      useDevicePixels: this.useDevicePixels,
      needsRedraw: null,
      tick: 0,
      tock: 0
    };
  }

  // Update the context object that will be passed to app callbacks
  _updateCallbackData() {
    // CallbackData width and height represent drawing buffer width and height
    const width = this.gl.drawingBufferWidth;
    const height = this.gl.drawingBufferHeight;
    if (width !== this._callbackData.width || height !== this._callbackData.height) {
      this.setNeedsRedraw('drawing buffer resized');
    }
    this._callbackData.width = width;
    this._callbackData.height = height;
    this._callbackData.aspect = width / height;
    this._callbackData.needsRedraw = this.needsRedraw;
    this._callbackData.offScreen = this.offScreen;

    // Update redraw reason
    this._callbackData.needsRedraw = this.needsRedraw;
    this.needsRedraw = null;

    // Increment tick
    this._callbackData.tick++;
  }

  _finalizeCallbackData() {
    // call callback
    this.props.onFinalize(this._callbackData);
    // end callback
  }

  // Add application's data to the app context object
  _addCallbackData(appContext) {
    if (typeof appContext === 'object' && appContext !== null) {
      this._callbackData = Object.assign({}, this._callbackData, appContext);
    }
  }

  // Either uses supplied or existing context, or calls provided callback to create one
  _createWebGLContext(opts) {
    // Create the WebGL context if necessary
    opts = Object.assign({}, opts, DEFAULT_GL_OPTIONS, this.props.glOptions);
    this.gl = this.props.gl || this.props.onCreateContext(opts);

    if (!isWebGL(this.gl)) {
      throw new Error('AnimationLoop.onCreateContext - illegal context returned');
    }

    if (this.props.debug) {
      this.gl = makeDebugContext(this.gl);
    }

    // Reset the WebGL context.
    resetParameters(this.gl);
  }

  // Default viewport setup
  _resizeViewport() {
    if (this.autoResizeViewport) {
      this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    }
  }

  // Resize the render buffer of the canvas to match canvas client size
  // Optionally multiplying with devicePixel ratio
  _resizeCanvasDrawingBuffer() {
    if (this.autoResizeDrawingBuffer) {
      resizeGLContext(this.gl, {useDevicePixels: this.useDevicePixels});
    }
  }

  // TBD - deprecated?
  _createFramebuffer() {
    // Setup default framebuffer
    if (this.props.createFramebuffer) {
      this.framebuffer = new Framebuffer(this.gl);
    }
  }

  _resizeFramebuffer() {
    if (this.framebuffer) {
      this.framebuffer.resize({
        width: this.gl.drawingBufferWidth,
        height: this.gl.drawingBufferHeight
      });
    }
  }
}
