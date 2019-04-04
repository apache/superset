// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import LayerManager from '../lib/layer-manager';
import EffectManager from '../experimental/lib/effect-manager';
import Effect from '../experimental/lib/effect';
import log from '../utils/log';

import {GL, AnimationLoop, createGLContext, setParameters} from 'luma.gl';
import {Stats} from 'probe.gl';
import {EventManager} from 'mjolnir.js';

import assert from '../utils/assert';
/* global document */

// TODO - move into Controller classes
import {MAPBOX_LIMITS} from '../controllers/map-controller';

function noop() {}

function getPropTypes(PropTypes) {
  // Note: Arrays (layers, views, ) can contain falsy values
  return {
    id: PropTypes.string,
    width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),

    // layer/view/controller settings
    layers: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    layerFilter: PropTypes.func,
    views: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    viewState: PropTypes.object,
    controller: PropTypes.func,
    onViewStateChange: PropTypes.func,
    effects: PropTypes.arrayOf(PropTypes.instanceOf(Effect)),

    // GL settings
    glOptions: PropTypes.object,
    gl: PropTypes.object,
    pickingRadius: PropTypes.number,

    onWebGLInitialized: PropTypes.func,
    onResize: PropTypes.func,
    onBeforeRender: PropTypes.func,
    onAfterRender: PropTypes.func,
    onLayerClick: PropTypes.func,
    onLayerHover: PropTypes.func,
    useDevicePixels: PropTypes.bool,

    // Debug settings
    debug: PropTypes.bool,
    drawPickingColors: PropTypes.bool
  };
}

const defaultProps = {
  id: 'deckgl-overlay',
  width: '100%',
  height: '100%',

  pickingRadius: 0,
  layerFilter: null,
  glOptions: {},
  gl: null,
  layers: [],
  effects: [],
  views: null,
  controller: null, // Rely on external controller, e.g. react-map-gl

  onWebGLInitialized: noop,
  onBeforeRender: noop,
  onAfterRender: noop,
  onLayerClick: null,
  onLayerHover: null,
  useDevicePixels: true,

  debug: false,
  drawPickingColors: false
};

const PREFIX = '-webkit-';

const CURSOR = {
  GRABBING: `${PREFIX}grabbing`,
  GRAB: `${PREFIX}grab`,
  POINTER: 'pointer'
};

const getCursor = ({isDragging}) => (isDragging ? CURSOR.GRABBING : CURSOR.GRAB);

// TODO - move into Controller classes
const defaultControllerProps = Object.assign({}, MAPBOX_LIMITS, {
  scrollZoom: true,
  dragPan: true,
  dragRotate: true,
  doubleClickZoom: true,
  touchZoomRotate: true,
  getCursor
});

export default class Deck {
  constructor(props) {
    props = Object.assign({}, defaultProps, props);

    this.width = 0; // "read-only", auto-updated from canvas
    this.height = 0; // "read-only", auto-updated from canvas
    this.needsRedraw = true;
    this.layerManager = null;
    this.effectManager = null;
    this.controller = null;
    this.stats = new Stats({id: 'deck.gl'});

    this.viewState = props.initialViewState || null; // Internal view state if no callback is supplied
    this.interactiveState = {
      isDragging: false // Whether the cursor is down
    };

    // Bind methods
    this._onRendererInitialized = this._onRendererInitialized.bind(this);
    this._onRenderFrame = this._onRenderFrame.bind(this);
    this._onViewStateChange = this._onViewStateChange.bind(this);
    this._onInteractiveStateChange = this._onInteractiveStateChange.bind(this);

    // Note: LayerManager creation deferred until gl context available
    this.canvas = this._createCanvas(props);
    this.controller = this._createController(props);
    this.animationLoop = this._createAnimationLoop(props);

    this.setProps(props);

    this.animationLoop.start();
  }

  finalize() {
    this.animationLoop.stop();
    this.animationLoop = null;

    if (this.layerManager) {
      this.layerManager.finalize();
      this.layerManager = null;
    }

    if (this.controller) {
      this.controller.finalize();
      this.controller = null;
    }

    if (this.eventManager) {
      this.eventManager.destroy();
    }
  }

  setProps(props) {
    this.stats.timeStart('deck.setProps');
    props = Object.assign({}, this.props, props);
    this.props = props;

    // Update CSS size of canvas
    this._setCanvasSize(props);

    // We need to overwrite CSS style width and height with actual, numeric values
    const newProps = Object.assign({}, props, {
      viewState: this._getViewState(props),
      width: this.width,
      height: this.height
    });

    // Update layer manager props (but not size)
    if (this.layerManager) {
      this.layerManager.setParameters(newProps);
    }

    // Update animation loop
    if (this.animationLoop) {
      this.animationLoop.setProps(newProps);
    }

    // Update controller props
    if (this.controller) {
      this.controller.setProps(
        Object.assign(newProps, {
          onViewStateChange: this._onViewStateChange
        })
      );
    }
    this.stats.timeEnd('deck.setProps');
  }

  // Public API

  pickObject({x, y, radius = 0, layerIds = null}) {
    this.stats.timeStart('deck.pickObject');
    const selectedInfos = this.layerManager.pickObject({
      x,
      y,
      radius,
      layerIds,
      mode: 'query',
      depth: 1
    });
    this.stats.timeEnd('deck.pickObject');
    return selectedInfos.length ? selectedInfos[0] : null;
  }

  pickMultipleObjects({x, y, radius = 0, layerIds = null, depth = 10}) {
    this.stats.timeStart('deck.pickMultipleObjects');
    const selectedInfos = this.layerManager.pickObject({
      x,
      y,
      radius,
      layerIds,
      mode: 'query',
      depth
    });
    this.stats.timeEnd('deck.pickMultipleObjects');
    return selectedInfos;
  }

  pickObjects({x, y, width = 1, height = 1, layerIds = null}) {
    this.stats.timeStart('deck.pickObjects');
    const infos = this.layerManager.pickObjects({x, y, width, height, layerIds});
    this.stats.timeEnd('deck.pickObjects');
    return infos;
  }

  getViewports() {
    return this.layerManager ? this.layerManager.getViewports() : [];
  }

  // Private Methods

  // canvas, either string, canvas or `null`
  _createCanvas(props) {
    let canvas = props.canvas;

    // TODO EventManager should accept element id
    if (typeof canvas === 'string') {
      /* global document */
      canvas = document.getElementById(canvas);
      assert(canvas);
    }

    if (!canvas) {
      canvas = document.createElement('canvas');
      const parent = props.parent || document.body;
      parent.appendChild(canvas);
    }

    const {id, style} = props;
    canvas.id = id;
    Object.assign(canvas.style, style);

    return canvas;
  }

  // Updates canvas width and/or height, if provided as props
  _setCanvasSize(props) {
    const {canvas} = this;
    let {width, height} = props;
    // Set size ONLY if props are being provided, otherwise let canvas be layouted freely
    if (width || width === 0) {
      width = Number.isFinite(width) ? `${width}px` : width;
      canvas.style.width = width;
    }
    if (height || height === 0) {
      height = Number.isFinite(height) ? `${height}px` : height;
      // Note: position==='absolute' required for height 100% to work
      canvas.style.position = 'absolute';
      canvas.style.height = height;
    }
  }

  // If canvas size has changed, updates
  _updateCanvasSize() {
    if (this._checkForCanvasSizeChange()) {
      const {width, height} = this;
      this.layerManager.setParameters({width, height});
      if (this.controller) {
        this.controller.setProps({
          viewState: this._getViewState(this.props),
          width: this.width,
          height: this.height
        });
      }
      if (this.props.onResize) {
        this.props.onResize({width: this.width, height: this.height});
      }
    }
  }

  // If canvas size has changed, reads out the new size and returns true
  _checkForCanvasSizeChange() {
    const {canvas} = this;
    if (canvas && (this.width !== canvas.clientWidth || this.height !== canvas.clientHeight)) {
      this.width = canvas.clientWidth;
      this.height = canvas.clientHeight;
      return true;
    }
    return false;
  }

  // Note: props.controller must be a class constructor, not an already created instance
  _createController(props) {
    let controller = null;

    if (props.controller) {
      const Controller = props.controller;
      controller = new Controller(props);
      controller.setProps(
        Object.assign({}, this.props, defaultControllerProps, {
          eventManager: this.eventManager,
          viewState: this._getViewState(props),
          // Set an internal callback that calls the prop callback if provided
          onViewStateChange: this._onViewStateChange,
          onStateChange: this._onInteractiveStateChange
        })
      );
    }

    return controller;
  }

  _createAnimationLoop(props) {
    const {width, height, gl, glOptions, debug, useDevicePixels, autoResizeDrawingBuffer} = props;

    return new AnimationLoop({
      width,
      height,
      useDevicePixels,
      autoResizeDrawingBuffer,
      onCreateContext: opts =>
        gl || createGLContext(Object.assign({}, glOptions, opts, {canvas: this.canvas, debug})),
      onInitialize: this._onRendererInitialized,
      onRender: this._onRenderFrame,
      onBeforeRender: props.onBeforeRender,
      onAfterRender: props.onAfterRender
    });
  }

  // Get the most relevant view state: props.viewState, if supplied, shadows internal viewState
  // TODO: For backwards compatibility ensure numeric width and height is added to the viewState
  _getViewState(props) {
    return Object.assign({}, props.viewState || this.viewState || {}, {
      width: this.width,
      height: this.height
    });
  }

  // Callbacks

  _onViewStateChange({viewState}, ...args) {
    // Let app know that view state is changing, and give it a chance to change it
    if (this.props.onViewStateChange) {
      viewState = this.props.onViewStateChange({viewState}, ...args) || viewState;
    }

    // If initialViewState was set on creation, auto track position
    if (this.viewState) {
      this.viewState = viewState;
      this.layerManager.setParameters({viewState});
      this.controller.setProps({viewState});
    }
  }

  _onInteractiveStateChange({isDragging = false}) {
    if (isDragging !== this.interactiveState.isDragging) {
      this.interactiveState.isDragging = isDragging;
      if (this.props.getCursor) {
        this.canvas.style.cursor = this.props.getCursor(this.interactiveState);
      }
    }
  }

  _onRendererInitialized({gl, canvas}) {
    setParameters(gl, {
      blend: true,
      blendFunc: [GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA],
      polygonOffsetFill: true,
      depthTest: true,
      depthFunc: GL.LEQUAL
    });

    this.props.onWebGLInitialized(gl);

    this.eventManager = new EventManager(canvas);
    if (this.controller) {
      this.controller.setProps({eventManager: this.eventManager});
    }

    // Note: avoid React setState due GL animation loop / setState timing issue
    this.layerManager = new LayerManager(gl, {
      eventManager: this.eventManager,
      stats: this.stats
    });

    this.effectManager = new EffectManager({gl, layerManager: this.layerManager});

    for (const effect of this.props.effects) {
      this.effectManager.addEffect(effect);
    }

    this.setProps(this.props);

    this._updateCanvasSize();
  }

  _onRenderFrame({gl}) {
    if (this.stats.oneSecondPassed()) {
      const table = this.stats.getStatsTable();
      this.stats.reset();
      log.table(1, table)();
    }

    this._updateCanvasSize();

    // Update layers if needed (e.g. some async prop has loaded)
    this.layerManager.updateLayers();

    this.stats.bump('fps');

    const redrawReason = this.layerManager.needsRedraw({clearRedrawFlags: true});
    if (!redrawReason) {
      return;
    }

    this.stats.bump('render-fps');

    if (this.props.onBeforeRender) {
      this.props.onBeforeRender({gl}); // TODO - should be called by AnimationLoop
    }
    this.layerManager.drawLayers({
      pass: 'screen',
      redrawReason,
      // Helps debug layer picking, especially in framebuffer powered layers
      drawPickingColors: this.props.drawPickingColors
    });
    if (this.props.onAfterRender) {
      this.props.onAfterRender({gl}); // TODO - should be called by AnimationLoop
    }
  }
}

Deck.displayName = 'Deck';
Deck.getPropTypes = getPropTypes;
Deck.defaultProps = defaultProps;
