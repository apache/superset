/* global window */
import AnimationLoop from './animation-loop';
import {getPageLoadPromise, createCanvas} from '../webgl-context';
import {requestAnimationFrame, cancelAnimationFrame} from '../webgl-utils';

export default class AnimationLoopProxy {

  // Create the script for the rendering worker.
  // @param opts {object} - options to construct an AnimationLoop instance
  static createWorker(opts) {
    return self => {

      self.animationLoop = new AnimationLoop(Object.assign({}, opts, {
        offScreen: true,
        // Prevent the animation loop from trying to access DOM properties
        useDevicePixels: false,
        autoResizeDrawingBuffer: false
      }));
      self.canvas = null;

      self.addEventListener('message', evt => {
        const {animationLoop} = self;

        switch (evt.data.command) {

        case 'start':
          self.canvas = evt.data.opts.canvas;
          animationLoop.start(evt.data.opts);
          break;

        case 'stop':
          animationLoop.stop();
          break;

        case 'resize':
          self.canvas.width = evt.data.width;
          self.canvas.height = evt.data.height;
          break;

        default:
        }

      });

    };
  }

  /*
   * @param {HTMLCanvasElement} canvas - if provided, width and height will be passed to context
   */
  constructor({
    worker,
    onInitialize = () => {},
    onFinalize = () => {},
    useDevicePixels = true,
    autoResizeDrawingBuffer = true
  }) {
    this.props = {
      worker,
      onInitialize,
      onFinalize,
      autoResizeDrawingBuffer,
      useDevicePixels
    };

    // state
    this.canvas = null;
    this.width = null;
    this.height = null;

    this._stopped = true;
    this._animationFrameId = null;
    this._startPromise = null;

    // bind methods
    this._updateFrame = this._updateFrame.bind(this);
  }

  /* Public methods */

  // Starts a render loop if not already running
  start(opts = {}) {
    this._stopped = false;
    // console.debug(`Starting ${this.constructor.name}`);
    if (!this._animationFrameId) {
      // Wait for start promise before rendering frame
      this._startPromise = getPageLoadPromise()
      .then(() => {
        this._createAndTransferCanvas(opts);
        return this.props.onInitialize(this);
      })
      .then(() => {
        if (!this._stopped) {
          this._animationFrameId = requestAnimationFrame(this._updateFrame);
        }
      });
    }
    return this;
  }

  // Stops a render loop if already running, finalizing
  stop() {
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
      this._stopped = true;
      this.props.onFinalize(this);
    }
    this.props.worker.postMessage({command: 'stop'});
    return this;
  }

  // PRIVATE METHODS

  _updateFrame() {
    this._resizeCanvasDrawingBuffer();
    this._animationFrameId = requestAnimationFrame(this._updateFrame);
  }

  _createAndTransferCanvas(opts) {
    // Create a canvas on the main thread
    const screenCanvas = createCanvas(opts);

    // Create an offscreen canvas controlling the main canvas
    if (!screenCanvas.transferControlToOffscreen) {
      onError('OffscreenCanvas is not available. Enable Experimental canvas features in chrome://flags'); // eslint-disable-line
    }
    const offscreenCanvas = screenCanvas.transferControlToOffscreen();

    // Transfer the offscreen canvas to the worker
    this.props.worker.postMessage({
      command: 'start',
      opts: Object.assign({}, opts, {canvas: offscreenCanvas})
    }, [offscreenCanvas]);

    // store the main canvas on the local thread
    this.canvas = screenCanvas;
  }

  _resizeCanvasDrawingBuffer() {
    if (this.props.autoResizeDrawingBuffer) {
      const devicePixelRatio = this.props.useDevicePixels ? (window.devicePixelRatio || 1) : 1;
      const width = this.canvas.clientWidth * devicePixelRatio;
      const height = this.canvas.clientHeight * devicePixelRatio;

      if (this.width !== width || this.height !== height) {
        this.width = width;
        this.height = height;
        this.props.worker.postMessage({
          command: 'resize',
          width,
          height
        });
      }
    }
  }
}
