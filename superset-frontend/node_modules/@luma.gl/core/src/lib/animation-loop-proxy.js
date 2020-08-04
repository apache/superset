/* global window, Worker */
import {getPageLoadPromise, getCanvas} from '@luma.gl/webgl';
import {requestAnimationFrame, cancelAnimationFrame} from '@luma.gl/webgl';
import {log, assert} from '../utils';

function initializeCanvas(_self, canvas) {
  const eventHandlers = new Map();

  canvas.addEventListener = (type, handler) => {
    _self.postMessage({command: 'addEventListener', type});
    if (!eventHandlers.has(type)) {
      eventHandlers.set(type, []);
    }
    eventHandlers.get(type).push(handler);
  };
  canvas.removeEventListener = (type, handler) => {
    _self.postMessage({command: 'removeEventListener', type});
    const handlers = eventHandlers.get(type);
    if (handlers) {
      handlers.splice(handlers.indexOf(handler), 1);
    }
  };
  canvas.dispatchEvent = (type, event) => {
    const handlers = eventHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  };

  _self.canvas = canvas;
}

export default class AnimationLoopProxy {
  // Create the script for the rendering worker.
  // @param opts {object} - options to construct an AnimationLoop instance
  static createWorker(animationLoop) {
    return self => {
      animationLoop.setProps({
        // Prevent the animation loop from trying to access DOM properties
        useDevicePixels: false,
        autoResizeDrawingBuffer: false
      });

      self.canvas = null;
      self.onmessage = evt => {
        const message = evt.data;
        switch (message.command) {
          case 'start':
            initializeCanvas(self, message.opts.canvas);
            animationLoop.start(message.opts);
            break;

          case 'stop':
            animationLoop.stop();
            break;

          case 'resize':
            self.canvas.width = message.width;
            self.canvas.height = message.height;
            break;

          case 'event':
            self.canvas.dispatchEvent(message.type, message.event);
            break;

          default:
        }
      };
    };
  }

  /*
   * @param {HTMLCanvasElement} canvas - if provided, width and height will be passed to context
   */
  constructor(worker, opts = {}) {
    const {
      onInitialize = () => {},
      onFinalize = () => {},
      useDevicePixels = true,
      autoResizeDrawingBuffer = true
    } = opts;

    this.props = {
      onInitialize,
      onFinalize
    };

    this.setProps({
      autoResizeDrawingBuffer,
      useDevicePixels
    });

    // state
    assert(worker instanceof Worker);
    this.worker = worker;
    this.canvas = null;
    this.width = null;
    this.height = null;

    this._running = false;
    this._animationFrameId = null;

    // bind methods
    this._onMessage = this._onMessage.bind(this);
    this._onEvent = this._onEvent.bind(this);
    this._updateFrame = this._updateFrame.bind(this);
  }

  setProps(props) {
    if ('autoResizeDrawingBuffer' in props) {
      this.autoResizeDrawingBuffer = props.autoResizeDrawingBuffer;
    }
    if ('useDevicePixels' in props) {
      this.useDevicePixels = props.useDevicePixels;
    }
    return this;
  }

  /* Public methods */

  // Starts a render loop if not already running
  start(opts = {}) {
    if (this._running) {
      return this;
    }
    this._running = true;
    // console.debug(`Starting ${this.constructor.name}`);
    this.worker.onmessage = this._onMessage;

    // Wait for start promise before rendering frame
    getPageLoadPromise()
      .then(() => {
        if (!this._running) {
          return null;
        }
        this._createAndTransferCanvas(opts);
        return this.props.onInitialize(this);
      })
      .then(() => {
        if (this._running) {
          this._animationFrameId = requestAnimationFrame(this._updateFrame);
        }
      });
    return this;
  }

  // Stops a render loop if already running, finalizing
  stop() {
    if (this._running) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
      this._running = false;
      this.props.onFinalize(this);
    }
    this.worker.postMessage({command: 'stop'});
    return this;
  }

  // PRIVATE METHODS

  _onMessage(evt) {
    switch (evt.data.command) {
      case 'addEventListener':
        this.canvas.addEventListener(evt.data.type, this._onEvent);
        break;

      case 'removeEventListener':
        this.canvas.removeEventListener(evt.data.type, this._onEvent);
        break;

      default:
    }
  }

  _onEvent(evt) {
    // TODO: get access to gl context and use 'cssToDevicePixels'
    const devicePixelRatio = this.useDevicePixels ? window.devicePixelRatio || 1 : 1;
    const type = evt.type;

    const safeEvent = {};
    for (const key in evt) {
      let value = evt[key];
      const valueType = typeof value;
      if (key === 'offsetX' || key === 'offsetY') {
        value *= devicePixelRatio;
      }
      if (valueType === 'number' || valueType === 'boolean' || valueType === 'string') {
        safeEvent[key] = value;
      }
    }

    this.worker.postMessage({
      command: 'event',
      type,
      event: safeEvent
    });
  }

  _updateFrame() {
    this._resizeCanvasDrawingBuffer();
    this._animationFrameId = requestAnimationFrame(this._updateFrame);
  }

  _createAndTransferCanvas(opts) {
    // Create a canvas on the main thread
    const screenCanvas = getCanvas(opts);

    // Create an offscreen canvas controlling the main canvas
    if (!screenCanvas.transferControlToOffscreen) {
      log.error('OffscreenCanvas is not available in your browser.')();
    }
    const offscreenCanvas = screenCanvas.transferControlToOffscreen();

    // Transfer the offscreen canvas to the worker
    this.worker.postMessage(
      {
        command: 'start',
        opts: Object.assign({}, opts, {canvas: offscreenCanvas})
      },
      [offscreenCanvas]
    );

    // store the main canvas on the local thread
    this.canvas = screenCanvas;
  }

  _resizeCanvasDrawingBuffer() {
    if (this.autoResizeDrawingBuffer) {
      // TODO: get access to gl context and use 'cssToDevicePixels'
      const devicePixelRatio = this.useDevicePixels ? window.devicePixelRatio || 1 : 1;
      const width = Math.ceil(this.canvas.clientWidth * devicePixelRatio);
      const height = Math.ceil(this.canvas.clientHeight * devicePixelRatio);

      if (this.width !== width || this.height !== height) {
        this.width = width;
        this.height = height;
        this.worker.postMessage({
          command: 'resize',
          width,
          height
        });
      }
    }
  }
}
