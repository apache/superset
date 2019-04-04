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

import assert from '../utils/assert';
import {Framebuffer, ShaderCache} from 'luma.gl';
import seer from 'seer';
import Layer from './layer';
import {drawLayers} from './draw-layers';
import {pickObject, pickVisibleObjects} from './pick-layers';
import {LIFECYCLE} from '../lifecycle/constants';
import ViewManager from '../views/view-manager';
import MapView from '../views/map-view';
import log from '../utils/log';
import {flatten} from '../utils/flatten';
import {Stats} from 'probe.gl';

import {
  setPropOverrides,
  layerEditListener,
  seerInitListener,
  initLayerInSeer,
  updateLayerInSeer
} from './seer-integration';

const LOG_PRIORITY_LIFECYCLE = 2;
const LOG_PRIORITY_LIFECYCLE_MINOR = 4;

// CONTEXT IS EXPOSED TO LAYERS
const INITIAL_CONTEXT = Object.seal({
  layerManager: null,
  gl: null,

  // Settings
  useDevicePixels: true, // Exposed in case custom layers need to adjust sizes

  // General resources
  stats: null, // for tracking lifecycle performance
  viewport: null, // Current viewport, exposed to layers for project* function

  // GL Resources
  shaderCache: null,
  pickingFBO: null, // Screen-size framebuffer that layers can reuse

  // State
  lastPickedInfo: {
    // For callback tracking and autohighlight
    index: -1,
    layerId: null
  },

  userData: {} // Place for any custom app `context`
});

const layerName = layer => (layer instanceof Layer ? `${layer}` : !layer ? 'null' : 'invalid');

export default class LayerManager {
  // eslint-disable-next-line
  constructor(gl, {eventManager, stats} = {}) {
    // Currently deck.gl expects the DeckGL.layers array to be different
    // whenever React rerenders. If the same layers array is used, the
    // LayerManager's diffing algorithm will generate a fatal error and
    // break the rendering.

    // `this.lastRenderedLayers` stores the UNFILTERED layers sent
    // down to LayerManager, so that `layers` reference can be compared.
    // If it's the same across two React render calls, the diffing logic
    // will be skipped.
    this.lastRenderedLayers = [];
    this.layers = [];

    this.context = Object.assign({}, INITIAL_CONTEXT, {
      layerManager: this,

      gl,
      // Enabling luma.gl Program caching using private API (_cachePrograms)
      shaderCache: new ShaderCache({gl, _cachePrograms: true}),
      stats: stats || new Stats({id: 'deck.gl'})
    });

    // Maps view descriptors to vieports, rebuilds when width/height/viewState/views change
    this.viewManager = new ViewManager();

    this.layerFilter = null;
    this.drawPickingColors = false;

    this._needsRedraw = 'Initial render';
    this._needsUpdate = false;

    // Event handling
    this._pickingRadius = 0;

    this._eventManager = null;
    this._onLayerClick = null;
    this._onLayerHover = null;
    this._onClick = this._onClick.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerLeave = this._onPointerLeave.bind(this);
    this._pickAndCallback = this._pickAndCallback.bind(this);

    // Seer integration
    this._initSeer = this._initSeer.bind(this);
    this._editSeer = this._editSeer.bind(this);

    // DEPRECATED
    this.width = 100;
    this.height = 100;

    Object.seal(this);

    seerInitListener(this._initSeer);
    layerEditListener(this._editSeer);

    if (eventManager) {
      this._initEventHandling(eventManager);
    }

    // Init with default map viewport
    this.setViews();
  }

  // Method to call when the layer manager is not needed anymore.
  // Currently used in the <DeckGL> componentWillUnmount lifecycle to unbind Seer listeners.
  finalize() {
    seer.removeListener(this._initSeer);
    seer.removeListener(this._editSeer);
  }

  // Check if a redraw is needed
  needsRedraw({clearRedrawFlags = true} = {}) {
    return this._checkIfNeedsRedraw(clearRedrawFlags);
  }

  // Check if a deep update of all layers is needed
  needsUpdate() {
    return this._needsUpdate;
  }

  // Layers will be redrawn (in next animation frame)
  setNeedsRedraw(reason) {
    this._needsRedraw = this._needsRedraw || reason;
  }

  // Layers will be updated deeply (in next animation frame)
  // Potentially regenerating attributes and sub layers
  setNeedsUpdate(reason) {
    this._needsUpdate = this._needsUpdate || reason;
  }

  // Gets an (optionally) filtered list of layers
  getLayers({layerIds = null} = {}) {
    // Filtering by layerId compares beginning of strings, so that sublayers will be included
    // Dependes on the convention of adding suffixes to the parent's layer name
    return layerIds
      ? this.layers.filter(layer => layerIds.find(layerId => layer.id.indexOf(layerId) === 0))
      : this.layers;
  }

  getViews() {
    return this.viewManager.views;
  }

  // Get a set of viewports for a given width and height
  getViewports() {
    const viewports = this.viewManager.getViewports();
    if (viewports.length) {
      this._activateViewport(viewports[0]);
    }
    return viewports;
  }

  /**
   * Set props needed for layer rendering and picking.
   * Parameters are to be passed as a single object, with the following values:
   * @param {Boolean} useDevicePixels
   */
  /* eslint-disable complexity, max-statements */
  setProps(props) {
    if ('eventManager' in props) {
      this._initEventHandling(props.eventManager);
    }

    if ('pickingRadius' in props || 'onLayerClick' in props || 'onLayerHover' in props) {
      this._setEventHandlingParameters(props);
    }

    if ('width' in props || 'height' in props) {
      this.viewManager.setSize(props.width, props.height);
      this.width = props.width;
      this.height = props.height;
    }

    if ('views' in props) {
      this.setViews(props.views);
    }

    // TODO - support multiple view states
    if ('viewState' in props) {
      this.viewManager.setViewState(props.viewState);
    }

    // TODO - For now we set layers before viewports to preserve changeFlags
    if ('layers' in props) {
      this.setLayers(props.layers);
    }

    if ('layerFilter' in props) {
      if (this.layerFilter !== props.layerFilter) {
        this.layerFilter = props.layerFilter;
        this.setNeedsRedraw('layerFilter changed');
      }
    }

    if ('drawPickingColors' in props) {
      if (props.drawPickingColors !== this.drawPickingColors) {
        this.drawPickingColors = props.drawPickingColors;
        this.setNeedsRedraw('drawPickingColors changed');
      }
    }

    // A way for apps to add data to context that can be accessed in layers
    if ('userData' in props) {
      this.context.userData = props.userData;
    }

    if ('useDevicePixels' in props) {
      this.context.useDevicePixels = props.useDevicePixels;
    }
  }
  /* eslint-enable complexity, max-statements */

  // Update the view descriptor list and set change flag if needed
  // Does not actually rebuild the `Viewport`s until `getViewports` is called
  setViews(views) {
    // For now, we default to a full screen map view port
    // TODO - apps may want to specify an empty view list...
    if (!views || views.length === 0) {
      views = [new MapView({id: 'default-view'})];
    }

    this.viewManager.setViews(views);
  }

  // Supply a new layer list, initiating sublayer generation and layer matching
  setLayers(newLayers) {
    this.getViewports();
    assert(this.context.viewport, 'LayerManager.updateLayers: viewport not set');

    // TODO - something is generating state updates that cause rerender of the same
    if (newLayers === this.lastRenderedLayers) {
      log.log(3, 'Ignoring layer update due to layer array not changed')();
      return this;
    }
    this.lastRenderedLayers = newLayers;

    newLayers = flatten(newLayers, {filter: Boolean});

    for (const layer of newLayers) {
      layer.context = this.context;
    }

    const {error, generatedLayers} = this._updateLayers({
      oldLayers: this.layers,
      newLayers
    });

    this.layers = generatedLayers;

    // Throw first error found, if any
    if (error) {
      throw error;
    }
    return this;
  }

  // Update layers from last cycle if `setNeedsUpdate()` has been called
  updateLayers() {
    // NOTE: For now, even if only some layer has changed, we update all layers
    // to ensure that layer id maps etc remain consistent even if different
    // sublayers are rendered
    const reason = this.needsUpdate();
    if (reason) {
      this.setNeedsRedraw(`updating layers: ${reason}`);
      // HACK - Call with a copy of lastRenderedLayers to trigger a full update
      this.setLayers([...this.lastRenderedLayers]);
    }
  }

  //
  // METHODS FOR LAYERS
  //

  // Draw all layers in all views
  drawLayers({pass = 'render to screen', redrawReason = 'unknown reason'} = {}) {
    const {drawPickingColors} = this;
    const {gl, useDevicePixels} = this.context;

    // render this viewport
    drawLayers(gl, {
      layers: this.layers,
      viewports: this.getViewports(),
      onViewportActive: this._activateViewport.bind(this),
      useDevicePixels,
      drawPickingColors,
      pass,
      layerFilter: this.layerFilter,
      redrawReason
    });
  }

  // Pick the closest info at given coordinate
  pickObject({x, y, mode, radius = 0, layerIds, layerFilter, depth = 1}) {
    const {gl, useDevicePixels} = this.context;

    const layers = this.getLayers({layerIds});

    return pickObject(gl, {
      // User params
      x,
      y,
      radius,
      layers,
      mode,
      layerFilter,
      depth,
      // Injected params
      viewports: this.getViewports(),
      onViewportActive: this._activateViewport.bind(this),
      pickingFBO: this._getPickingBuffer(),
      lastPickedInfo: this.context.lastPickedInfo,
      useDevicePixels
    });
  }

  // Get all unique infos within a bounding box
  pickObjects({x, y, width, height, layerIds, layerFilter}) {
    const {gl, useDevicePixels} = this.context;

    const layers = this.getLayers({layerIds});

    return pickVisibleObjects(gl, {
      x,
      y,
      width,
      height,
      layers,
      layerFilter,
      mode: 'pickObjects',
      viewports: this.getViewports(),
      onViewportActive: this._activateViewport.bind(this),
      pickingFBO: this._getPickingBuffer(),
      useDevicePixels
    });
  }

  //
  // DEPRECATED METHODS in V5.3
  //

  setParameters(parameters) {
    return this.setProps(parameters);
  }

  setSize(width, height) {
    this.setProps({width, height});
  }

  setViewState(viewState) {
    this.setProps({viewState});
  }

  //
  // DEPRECATED METHODS in V5.1
  //

  setViewports(viewports) {
    log.deprecated('setViewport', 'setViews')();
    this.setViews(viewports);
    return this;
  }

  //
  // DEPRECATED METHODS in V5
  //

  setViewport(viewport) {
    log.deprecated('setViewport', 'setViews')();
    this.setViews([viewport]);
    return this;
  }

  //
  // PRIVATE METHODS
  //

  _checkIfNeedsRedraw(clearRedrawFlags) {
    let redraw = this._needsRedraw;
    if (clearRedrawFlags) {
      this._needsRedraw = false;
    }

    redraw = redraw || this.viewManager.needsRedraw();

    // This layers list doesn't include sublayers, relying on composite layers
    for (const layer of this.layers) {
      // Call every layer to clear their flags
      const layerNeedsRedraw = layer.getNeedsRedraw({clearRedrawFlags});
      redraw = redraw || layerNeedsRedraw;
    }

    return redraw;
  }

  /**
   * @param {Object} eventManager   A source of DOM input events
   */
  _initEventHandling(eventManager) {
    this._eventManager = eventManager;

    // TODO: add/remove handlers on demand at runtime, not all at once on init.
    // Consider both top-level handlers like onLayerClick/Hover
    // and per-layer handlers attached to individual layers.
    // https://github.com/uber/deck.gl/issues/634
    this._eventManager.on({
      click: this._onClick,
      pointermove: this._onPointerMove,
      pointerleave: this._onPointerLeave
    });
  }

  // Set parameters for input event handling.
  _setEventHandlingParameters({pickingRadius, onLayerClick, onLayerHover}) {
    if (!isNaN(pickingRadius)) {
      this._pickingRadius = pickingRadius;
    }
    if (typeof onLayerClick !== 'undefined') {
      this._onLayerClick = onLayerClick;
    }
    if (typeof onLayerHover !== 'undefined') {
      this._onLayerHover = onLayerHover;
    }
    this._validateEventHandling();
  }

  // Make a viewport "current" in layer context, updating viewportChanged flags
  _activateViewport(viewport) {
    const oldViewport = this.context.viewport;
    const viewportChanged = !oldViewport || !viewport.equals(oldViewport);

    if (viewportChanged) {
      log.log(4, 'Viewport changed', viewport)();

      this.context.viewport = viewport;

      // Update layers states
      // Let screen space layers update their state based on viewport
      for (const layer of this.layers) {
        layer.setChangeFlags({viewportChanged: 'Viewport changed'});
        this._updateLayer(layer);
      }
    }

    assert(this.context.viewport, 'LayerManager: viewport not set');

    return this;
  }

  _getPickingBuffer() {
    const {gl} = this.context;
    // Create a frame buffer if not already available
    this.context.pickingFBO = this.context.pickingFBO || new Framebuffer(gl);
    // Resize it to current canvas size (this is a noop if size hasn't changed)
    this.context.pickingFBO.resize({width: gl.canvas.width, height: gl.canvas.height});
    return this.context.pickingFBO;
  }

  // Match all layers, checking for caught errors
  // To avoid having an exception in one layer disrupt other layers
  // TODO - mark layers with exceptions as bad and remove from rendering cycle?
  _updateLayers({oldLayers, newLayers}) {
    // Create old layer map
    const oldLayerMap = {};
    for (const oldLayer of oldLayers) {
      if (oldLayerMap[oldLayer.id]) {
        log.warn(`Multiple old layers with same id ${layerName(oldLayer)}`)();
      } else {
        oldLayerMap[oldLayer.id] = oldLayer;
      }
    }

    // Allocate array for generated layers
    const generatedLayers = [];

    // Match sublayers
    const error = this._updateSublayersRecursively({
      newLayers,
      oldLayerMap,
      generatedLayers
    });

    // Finalize unmatched layers
    const error2 = this._finalizeOldLayers(oldLayerMap);

    this._needsUpdate = false;

    const firstError = error || error2;
    return {error: firstError, generatedLayers};
  }

  // Note: adds generated layers to `generatedLayers` array parameter
  _updateSublayersRecursively({newLayers, oldLayerMap, generatedLayers}) {
    let error = null;

    for (const newLayer of newLayers) {
      newLayer.context = this.context;

      // Given a new coming layer, find its matching old layer (if any)
      const oldLayer = oldLayerMap[newLayer.id];
      if (oldLayer === null) {
        // null, rather than undefined, means this id was originally there
        log.warn(`Multiple new layers with same id ${layerName(newLayer)}`)();
      }
      // Remove the old layer from candidates, as it has been matched with this layer
      oldLayerMap[newLayer.id] = null;

      let sublayers = null;

      // We must not generate exceptions until after layer matching is complete
      try {
        if (!oldLayer) {
          this._initializeLayer(newLayer);
          initLayerInSeer(newLayer); // Initializes layer in seer chrome extension (if connected)
        } else {
          this._transferLayerState(oldLayer, newLayer);
          this._updateLayer(newLayer);
          updateLayerInSeer(newLayer); // Updates layer in seer chrome extension (if connected)
        }
        generatedLayers.push(newLayer);

        // Call layer lifecycle method: render sublayers
        sublayers = newLayer.isComposite && newLayer.getSubLayers();
        // End layer lifecycle method: render sublayers
      } catch (err) {
        log.warn(`error during matching of ${layerName(newLayer)}`, err);
        error = error || err; // Record first exception
      }

      if (sublayers) {
        this._updateSublayersRecursively({
          newLayers: sublayers,
          oldLayerMap,
          generatedLayers
        });
      }
    }

    return error;
  }

  // Finalize any old layers that were not matched
  _finalizeOldLayers(oldLayerMap) {
    let error = null;
    for (const layerId in oldLayerMap) {
      const layer = oldLayerMap[layerId];
      if (layer) {
        error = error || this._finalizeLayer(layer);
      }
    }
    return error;
  }

  // EXCEPTION SAFE LAYER ACCESS

  // Initializes a single layer, calling layer methods
  _initializeLayer(layer) {
    log.log(LOG_PRIORITY_LIFECYCLE, `initializing ${layerName(layer)}`)();

    let error = null;
    try {
      layer._initialize();
      layer.lifecycle = LIFECYCLE.INITIALIZED;
    } catch (err) {
      log.warn(`error while initializing ${layerName(layer)}\n`, err)();
      error = error || err;
      // TODO - what should the lifecycle state be here? LIFECYCLE.INITIALIZATION_FAILED?
    }

    // Set back pointer (used in picking)
    layer.internalState.layer = layer;

    // Save layer on model for picking purposes
    // store on model.userData rather than directly on model
    for (const model of layer.getModels()) {
      model.userData.layer = layer;
    }

    return error;
  }

  _transferLayerState(oldLayer, newLayer) {
    newLayer._transferState(oldLayer);
    newLayer.lifecycle = LIFECYCLE.MATCHED;

    if (newLayer !== oldLayer) {
      log.log(
        LOG_PRIORITY_LIFECYCLE_MINOR,
        `matched ${layerName(newLayer)}`,
        oldLayer,
        '->',
        newLayer
      )();
      oldLayer.lifecycle = LIFECYCLE.AWAITING_GC;
    } else {
      log.log(LOG_PRIORITY_LIFECYCLE_MINOR, `Matching layer is unchanged ${newLayer.id}`)();
    }
  }

  // Updates a single layer, cleaning all flags
  _updateLayer(layer) {
    log.log(
      LOG_PRIORITY_LIFECYCLE_MINOR,
      `updating ${layer} because: ${layer.printChangeFlags()}`
    )();
    let error = null;
    try {
      layer._update();
    } catch (err) {
      log.warn(`error during update of ${layerName(layer)}`, err)();
      // Save first error
      error = err;
    }
    return error;
  }

  // Finalizes a single layer
  _finalizeLayer(layer) {
    assert(layer.lifecycle !== LIFECYCLE.AWAITING_FINALIZATION);
    layer.lifecycle = LIFECYCLE.AWAITING_FINALIZATION;
    let error = null;
    this.setNeedsRedraw(`finalized ${layerName(layer)}`);
    try {
      layer._finalize();
    } catch (err) {
      log.warn(`error during finalization of ${layerName(layer)}`, err)();
      error = err;
    }
    layer.lifecycle = LIFECYCLE.FINALIZED;
    log.log(LOG_PRIORITY_LIFECYCLE, `finalizing ${layerName(layer)}`);
    return error;
  }

  /**
   * Warn if a deck-level mouse event has been specified,
   * but no layers are `pickable`.
   */
  _validateEventHandling() {
    if (this.onLayerClick || this.onLayerHover) {
      if (this.layers.length && !this.layers.some(layer => layer.props.pickable)) {
        log.warn(
          'You have supplied a top-level input event handler (e.g. `onLayerClick`), ' +
            'but none of your layers have set the `pickable` flag.'
        )();
      }
    }
  }

  /**
   * Route click events to layers.
   * `pickLayer` will call the `onClick` prop of any picked layer,
   * and `onLayerClick` is called directly from here
   * with any picking info generated by `pickLayer`.
   * @param {Object} event  An object encapsulating an input event,
   *                        with the following shape:
   *                        {Object: {x, y}} offsetCenter: center of the event
   *                        {Object} srcEvent:             native JS Event object
   */
  _onClick(event) {
    if (!event.offsetCenter) {
      // Do not trigger onHover callbacks when click position is invalid.
      return;
    }
    this._pickAndCallback({
      callback: this._onLayerClick,
      event,
      mode: 'click'
    });
  }

  /**
   * Route click events to layers.
   * `pickLayer` will call the `onHover` prop of any picked layer,
   * and `onLayerHover` is called directly from here
   * with any picking info generated by `pickLayer`.
   * @param {Object} event  An object encapsulating an input event,
   *                        with the following shape:
   *                        {Object: {x, y}} offsetCenter: center of the event
   *                        {Object} srcEvent:             native JS Event object
   */
  _onPointerMove(event) {
    if (event.leftButton || event.rightButton) {
      // Do not trigger onHover callbacks if mouse button is down.
      return;
    }
    this._pickAndCallback({
      callback: this._onLayerHover,
      event,
      mode: 'hover'
    });
  }

  _onPointerLeave(event) {
    this.pickObject({
      x: -1,
      y: -1,
      radius: this._pickingRadius,
      mode: 'hover'
    });
  }

  _pickAndCallback(options) {
    const pos = options.event.offsetCenter;
    const radius = this._pickingRadius;
    const selectedInfos = this.pickObject({x: pos.x, y: pos.y, radius, mode: options.mode});
    if (options.callback) {
      const firstInfo = selectedInfos.find(info => info.index >= 0) || null;
      // As per documentation, send null value when no valid object is picked.
      options.callback(firstInfo, selectedInfos, options.event.srcEvent);
    }
  }

  // SEER INTEGRATION

  /**
   * Called upon Seer initialization, manually sends layers data.
   */
  _initSeer() {
    this.layers.forEach(layer => {
      initLayerInSeer(layer);
      updateLayerInSeer(layer);
    });
  }

  /**
   * On Seer property edition, set override and update layers.
   */
  _editSeer(payload) {
    if (payload.type !== 'edit' || payload.valuePath[0] !== 'props') {
      return;
    }

    setPropOverrides(payload.itemKey, payload.valuePath.slice(1), payload.value);
    const newLayers = this.layers.map(layer => new layer.constructor(layer.props));
    this.updateLayers({newLayers});
  }
}
