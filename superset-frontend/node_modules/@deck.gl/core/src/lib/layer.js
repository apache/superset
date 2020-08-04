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

/* eslint-disable react/no-direct-mutation-state */
/* global fetch */
/* global window */
import {COORDINATE_SYSTEM} from './constants';
import AttributeManager from './attribute-manager';
import {removeLayerInSeer} from './seer-integration';
import {diffProps, validateProps} from '../lifecycle/props';
import {count} from '../utils/count';
import log from '../utils/log';
import GL from '@luma.gl/constants';
import {withParameters} from '@luma.gl/core';
import assert from '../utils/assert';
import {projectPosition, getWorldPosition} from '../shaderlib/project/project-functions';

import Component from '../lifecycle/component';
import LayerState from './layer-state';

import {worldToPixels} from 'viewport-mercator-project';

const LOG_PRIORITY_UPDATE = 1;

const EMPTY_ARRAY = Object.freeze([]);

let pickingColorCache = new Uint8ClampedArray(0);

const defaultProps = {
  // data: Special handling for null, see below
  data: {type: 'data', value: EMPTY_ARRAY, async: true},
  dataComparator: null,
  dataTransform: {type: 'function', value: data => data, compare: false},
  fetch: {
    type: 'function',
    value: url => fetch(url).then(response => response.json()),
    compare: false
  },
  updateTriggers: {}, // Update triggers: a core change detection mechanism in deck.gl
  numInstances: undefined,

  visible: true,
  pickable: false,
  opacity: {type: 'number', min: 0, max: 1, value: 0.8},

  onHover: {type: 'function', value: null, compare: false, optional: true},
  onClick: {type: 'function', value: null, compare: false, optional: true},
  onDragStart: {type: 'function', value: null, compare: false, optional: true},
  onDrag: {type: 'function', value: null, compare: false, optional: true},
  onDragEnd: {type: 'function', value: null, compare: false, optional: true},

  coordinateSystem: COORDINATE_SYSTEM.LNGLAT,
  coordinateOrigin: {type: 'array', value: [0, 0, 0], compare: true},
  modelMatrix: {type: 'array', value: null, compare: true, optional: true},
  wrapLongitude: false,

  parameters: {},
  uniforms: {},
  framebuffer: null,

  animation: null, // Passed prop animation functions to evaluate props

  // Offset depth based on layer index to avoid z-fighting.
  // Negative values pull layer towards the camera
  // https://www.opengl.org/archives/resources/faq/technical/polygonoffset.htm
  getPolygonOffset: {
    type: 'function',
    value: ({layerIndex}) => [0, -layerIndex * 100],
    compare: false
  },

  // Selection/Highlighting
  highlightedObjectIndex: null,
  autoHighlight: false,
  highlightColor: {type: 'color', value: [0, 0, 128, 128]}
};

export default class Layer extends Component {
  toString() {
    const className = this.constructor.layerName || this.constructor.name;
    return `${className}({id: '${this.props.id}'})`;
  }

  // Public API

  // Updates selected state members and marks the object for redraw
  setState(updateObject) {
    this.setChangeFlags({stateChanged: true});
    Object.assign(this.state, updateObject);
    this.setNeedsRedraw();
  }

  // Sets the redraw flag for this layer, will trigger a redraw next animation frame
  setNeedsRedraw(redraw = true) {
    if (this.internalState) {
      this.internalState.needsRedraw = redraw;
    }
  }

  // This layer needs a deep update
  // TODO - Need to align with existing needsUpdate before uncommenting
  // For now async props will call layerManager directly
  setLayerNeedsUpdate() {
    this.context.layerManager.setNeedsUpdate(String(this));
  }

  // Checks state of attributes and model
  getNeedsRedraw(opts = {clearRedrawFlags: false}) {
    return this._getNeedsRedraw(opts);
  }

  // Checks if layer attributes needs updating
  needsUpdate() {
    // Call subclass lifecycle method
    return this.shouldUpdateState(this._getUpdateParams());
    // End lifecycle method
  }

  // Returns true if the layer is pickable and visible.
  isPickable() {
    return this.props.pickable && this.props.visible;
  }

  // Return an array of models used by this layer, can be overriden by layer subclass
  getModels() {
    return this.state && (this.state.models || (this.state.model ? [this.state.model] : []));
  }

  // TODO - Gradually phase out, does not support multi model layers
  getSingleModel() {
    return this.state && this.state.model;
  }

  getAttributeManager() {
    return this.internalState && this.internalState.attributeManager;
  }

  // Returns the most recent layer that matched to this state
  // (When reacting to an async event, this layer may no longer be the latest)
  getCurrentLayer() {
    return this.internalState && this.internalState.layer;
  }

  // Use iteration (the only required capability on data) to get first element
  // deprecated since we are effectively only supporting Arrays
  getFirstObject() {
    const {data} = this.props;
    for (const object of data) {
      return object;
    }
    return null;
  }

  // PROJECTION METHODS

  // Projects a point with current map state (lat, lon, zoom, pitch, bearing)
  // From the current layer's coordinate system to screen
  project(xyz) {
    const {viewport} = this.context;
    const worldPosition = getWorldPosition(xyz, {
      viewport,
      modelMatrix: this.props.modelMatrix,
      coordinateOrigin: this.props.coordinateOrigin,
      coordinateSystem: this.props.coordinateSystem
    });
    const [x, y, z] = worldToPixels(worldPosition, viewport.pixelProjectionMatrix);
    return xyz.length === 2 ? [x, y] : [x, y, z];
  }

  // Note: this does not reverse `project`.
  // Always unprojects to the viewport's coordinate system
  unproject(xy) {
    const {viewport} = this.context;
    assert(Array.isArray(xy));
    return viewport.unproject(xy);
  }

  projectPosition(xyz) {
    assert(Array.isArray(xyz));

    return projectPosition(xyz, {
      viewport: this.context.viewport,
      modelMatrix: this.props.modelMatrix,
      coordinateOrigin: this.props.coordinateOrigin,
      coordinateSystem: this.props.coordinateSystem
    });
  }

  // DEPRECATE: This does not handle offset modes
  projectFlat(lngLat) {
    log.deprecated('layer.projectFlat', 'layer.projectPosition')();
    const {viewport} = this.context;
    assert(Array.isArray(lngLat));
    return viewport.projectFlat(lngLat);
  }

  // DEPRECATE: This is not meaningful in offset modes
  unprojectFlat(xy) {
    log.deprecated('layer.unprojectFlat')();
    const {viewport} = this.context;
    assert(Array.isArray(xy));
    return viewport.unprojectFlat(xy);
  }

  use64bitProjection() {
    if (this.props.fp64) {
      if (this.props.coordinateSystem === COORDINATE_SYSTEM.LNGLAT_DEPRECATED) {
        return true;
      }
      log.once(
        0,
        `Legacy 64-bit mode only works with coordinateSystem set to
        COORDINATE_SYSTEM.LNGLAT_DEPRECATED. Rendering in 32-bit mode instead`
      )();
    }

    return false;
  }

  use64bitPositions() {
    return (
      this.props.fp64 ||
      this.props.coordinateSystem === COORDINATE_SYSTEM.LNGLAT ||
      this.props.coordinateSystem === COORDINATE_SYSTEM.IDENTITY
    );
  }

  // TODO - needs to refer to context for devicePixels setting
  screenToDevicePixels(screenPixels) {
    log.deprecated('screenToDevicePixels', 'DeckGL prop useDevicePixels for conversion')();
    const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    return screenPixels * devicePixelRatio;
  }

  // Event handling
  onHover(info, pickingEvent) {
    if (this.props.onHover) {
      return this.props.onHover(info, pickingEvent);
    }
    return false;
  }

  onClick(info, pickingEvent) {
    if (this.props.onClick) {
      return this.props.onClick(info, pickingEvent);
    }
    return false;
  }

  // Returns the picking color that doesn't match any subfeature
  // Use if some graphics do not belong to any pickable subfeature
  // @return {Array} - a black color
  nullPickingColor() {
    return [0, 0, 0];
  }

  // Returns the picking color that doesn't match any subfeature
  // Use if some graphics do not belong to any pickable subfeature
  encodePickingColor(i, target = []) {
    assert(i < 16777215, 'index out of picking color range');
    target[0] = (i + 1) & 255;
    target[1] = ((i + 1) >> 8) & 255;
    target[2] = (((i + 1) >> 8) >> 8) & 255;
    return target;
  }

  // Returns the index corresponding to a picking color that doesn't match any subfeature
  // @param {Uint8Array} color - color array to be decoded
  // @return {Array} - the decoded picking color
  decodePickingColor(color) {
    assert(color instanceof Uint8Array);
    const [i1, i2, i3] = color;
    // 1 was added to seperate from no selection
    const index = i1 + i2 * 256 + i3 * 65536 - 1;
    return index;
  }

  // //////////////////////////////////////////////////
  // LIFECYCLE METHODS, overridden by the layer subclasses

  // Called once to set up the initial state
  // App can create WebGL resources
  initializeState() {
    throw new Error(`Layer ${this} has not defined initializeState`);
  }

  // Let's layer control if updateState should be called
  shouldUpdateState({oldProps, props, context, changeFlags}) {
    return changeFlags.propsOrDataChanged;
  }

  // Default implementation, all attributes will be invalidated and updated
  // when data changes
  updateState({oldProps, props, context, changeFlags}) {
    const attributeManager = this.getAttributeManager();
    if (changeFlags.dataChanged && attributeManager) {
      attributeManager.invalidateAll();
    }
  }

  // Called once when layer is no longer matched and state will be discarded
  // App can destroy WebGL resources here
  finalizeState() {
    for (const model of this.getModels()) {
      model.delete();
    }
    const attributeManager = this.getAttributeManager();
    if (attributeManager) {
      attributeManager.finalize();
    }
  }

  // If state has a model, draw it with supplied uniforms
  draw(opts) {
    for (const model of this.getModels()) {
      model.draw(opts);
    }
  }

  // called to populate the info object that is passed to the event handler
  // @return null to cancel event
  getPickingInfo({info, mode}) {
    const {index} = info;

    if (index >= 0) {
      // If props.data is an indexable array, get the object
      if (Array.isArray(this.props.data)) {
        info.object = this.props.data[index];
      }
    }

    return info;
  }

  // END LIFECYCLE METHODS
  // //////////////////////////////////////////////////

  // INTERNAL METHODS

  // Default implementation of attribute invalidation, can be redefined
  invalidateAttribute(name = 'all', diffReason = '') {
    const attributeManager = this.getAttributeManager();
    if (!attributeManager) {
      return;
    }

    if (name === 'all') {
      log.log(LOG_PRIORITY_UPDATE, `updateTriggers invalidating all attributes: ${diffReason}`)();
      attributeManager.invalidateAll();
    } else {
      log.log(
        LOG_PRIORITY_UPDATE,
        `updateTriggers invalidating attribute ${name}: ${diffReason}`
      )();
      attributeManager.invalidate(name);
    }
  }

  // Calls attribute manager to update any WebGL attributes
  updateAttributes(props) {
    const attributeManager = this.getAttributeManager();
    if (!attributeManager) {
      return;
    }

    // Figure out data length
    const numInstances = this.getNumInstances(props);
    const bufferLayout = this.getBufferLayout(props);

    attributeManager.update({
      data: props.data,
      numInstances,
      bufferLayout,
      props,
      transitions: props.transitions,
      buffers: props,
      context: this,
      // Don't worry about non-attribute props
      ignoreUnknownAttributes: true
    });

    const models = this.getModels();

    if (models.length > 0) {
      const changedAttributes = attributeManager.getChangedAttributes({clearChangedFlags: true});
      for (let i = 0, len = models.length; i < len; ++i) {
        this._setModelAttributes(models[i], changedAttributes);
      }
    }
  }

  // Update attribute transition
  updateTransition() {
    const attributeManager = this.getAttributeManager();
    if (attributeManager) {
      attributeManager.updateTransition(this.context.time);
    }
  }

  calculateInstancePickingColors(attribute, {numInstances}) {
    const {value, size} = attribute;

    if (value[0] === 1) {
      // This can happen when data has changed, but the attribute value typed array
      // has sufficient size and does not need to be re-allocated.
      // This attribute is already populated, we do not have to recalculate it
      return;
    }

    // calculateInstancePickingColors always generates the same sequence.
    // pickingColorCache saves the largest generated sequence for reuse
    const cacheSize = pickingColorCache.length / size;

    if (cacheSize < numInstances) {
      // If the attribute is larger than the cache, resize the cache and populate the missing chunk
      const newPickingColorCache = new Uint8ClampedArray(numInstances * size);
      newPickingColorCache.set(pickingColorCache);
      const pickingColor = [];

      for (let i = cacheSize; i < numInstances; i++) {
        this.encodePickingColor(i, pickingColor);
        newPickingColorCache[i * size + 0] = pickingColor[0];
        newPickingColorCache[i * size + 1] = pickingColor[1];
        newPickingColorCache[i * size + 2] = pickingColor[2];
      }

      pickingColorCache = newPickingColorCache;
    }

    // Copy the last calculated picking color sequence into the attribute
    value.set(
      numInstances < cacheSize
        ? pickingColorCache.subarray(0, numInstances * size)
        : pickingColorCache
    );
  }

  _setModelAttributes(model, changedAttributes) {
    const shaderAttributes = {};
    const excludeAttributes = model.userData.excludeAttributes || {};
    for (const attributeName in changedAttributes) {
      if (!excludeAttributes[attributeName]) {
        Object.assign(shaderAttributes, changedAttributes[attributeName].getShaderAttributes());
      }
    }

    model.setAttributes(shaderAttributes);
  }

  // Sets the specified instanced picking color to null picking color. Used for multi picking.
  _clearInstancePickingColor(color) {
    const {instancePickingColors} = this.getAttributeManager().attributes;
    const {value, size} = instancePickingColors;

    const i = this.decodePickingColor(color);
    value[i * size + 0] = 0;
    value[i * size + 1] = 0;
    value[i * size + 2] = 0;

    // TODO: Optimize this to use sub-buffer update!
    instancePickingColors.update({value});
  }

  // Sets all occurrences of the specified picking color to null picking color. Used for multi picking.
  _clearPickingColor(color) {
    const {pickingColors} = this.getAttributeManager().attributes;
    const {value} = pickingColors;

    for (let i = 0; i < value.length; i += 3) {
      if (value[i + 0] === color[0] && value[i + 1] === color[1] && value[i + 2] === color[2]) {
        value[i + 0] = 0;
        value[i + 1] = 0;
        value[i + 2] = 0;
      }
    }

    // TODO: Optimize this to use sub-buffer update!
    pickingColors.update({value});
  }

  // This method figures out if we use instance colors or not
  // and calls _clearInstancePickingColor or _clearPickingColor
  clearPickingColor(color) {
    if (this.getAttributeManager().attributes.pickingColors) {
      this._clearPickingColor(color);
    } else {
      this._clearInstancePickingColor(color);
    }
  }

  copyPickingColors() {
    const {pickingColors, instancePickingColors} = this.getAttributeManager().attributes;
    const colors = pickingColors || instancePickingColors;

    return new Uint8ClampedArray(colors.value);
  }

  restorePickingColors(value) {
    const {pickingColors, instancePickingColors} = this.getAttributeManager().attributes;
    const colors = pickingColors || instancePickingColors;

    colors.update({value});
  }

  // Deduces numer of instances. Intention is to support:
  // - Explicit setting of numInstances
  // - Auto-deduction for ES6 containers that define a size member
  // - Auto-deduction for Classic Arrays via the built-in length attribute
  // - Auto-deduction via arrays
  getNumInstances(props) {
    props = props || this.props;

    // First Check if app has provided an explicit value
    if (props.numInstances !== undefined) {
      return props.numInstances;
    }

    // Second check if the layer has set its own value
    if (this.state && this.state.numInstances !== undefined) {
      return this.state.numInstances;
    }

    // Use container library to get a count for any ES6 container or object
    const {data} = this.props;
    return count(data);
  }

  // Buffer layout describes how many attribute values are packed for each data object
  // The default (null) is one value each object.
  // Some data formats (e.g. paths, polygons) have various length. Their buffer layout
  //  is in the form of [L0, L1, L2, ...]
  getBufferLayout(props) {
    props = props || this.props;

    // First Check if bufferLayout is provided as an explicit value
    if (props.bufferLayout !== undefined) {
      return props.bufferLayout;
    }

    // Second check if the layer has set its own value
    if (this.state && this.state.bufferLayout !== undefined) {
      return this.state.bufferLayout;
    }

    return null;
  }

  // LAYER MANAGER API
  // Should only be called by the deck.gl LayerManager class

  // Called by layer manager when a new layer is found
  /* eslint-disable max-statements */
  _initialize() {
    this._initState();

    // Call subclass lifecycle methods
    this.initializeState(this.context);
    // End subclass lifecycle methods

    // TODO deprecated, for backwards compatibility with older layers
    // in case layer resets state
    this.state.attributeManager = this.getAttributeManager();

    // initializeState callback tends to clear state
    this.setChangeFlags({dataChanged: true, propsChanged: true, viewportChanged: true});

    this._updateState();

    const model = this.getSingleModel();
    if (model) {
      model.id = this.props.id;
      model.program.id = `${this.props.id}-program`;
    }
  }

  // Called by layer manager
  // if this layer is new (not matched with an existing layer) oldProps will be empty object
  _update() {
    // Call subclass lifecycle method
    const stateNeedsUpdate = this.needsUpdate();
    // End lifecycle method

    if (stateNeedsUpdate) {
      this._updateState();
    }
  }
  /* eslint-enable max-statements */

  // Common code for _initialize and _update
  _updateState() {
    const updateParams = this._getUpdateParams();

    // Safely call subclass lifecycle methods
    if (this.context.gl) {
      this.updateState(updateParams);
    } else {
      try {
        this.updateState(updateParams);
      } catch (error) {
        // ignore error if gl context is missing
      }
    }
    // End subclass lifecycle methods

    if (this.isComposite) {
      // Render or update previously rendered sublayers
      this._renderLayers(updateParams);
    } else {
      this.setNeedsRedraw();
      // Add any subclass attributes
      this.updateAttributes(this.props);
      this._updateBaseUniforms();

      // Note: Automatic instance count update only works for single layers
      if (this.state.model) {
        this.state.model.setInstanceCount(this.getNumInstances());
      }
    }

    this.clearChangeFlags();
    this.internalState.resetOldProps();
  }

  // Called by manager when layer is about to be disposed
  // Note: not guaranteed to be called on application shutdown
  _finalize() {
    assert(this.internalState && this.state);

    // Call subclass lifecycle method
    this.finalizeState(this.context);
    // End lifecycle method
    removeLayerInSeer(this.id);
  }

  // Calculates uniforms
  drawLayer({moduleParameters = null, uniforms = {}, parameters = {}}) {
    if (!uniforms.picking_uActive) {
      this.updateTransition();
    }

    // TODO/ib - hack move to luma Model.draw
    if (moduleParameters) {
      this.setModuleParameters(moduleParameters);
    }

    // Hack/ib - define a public luma function
    const {animationProps} = this.context;
    if (animationProps) {
      for (const model of this.getModels()) {
        model._setAnimationProps(animationProps);
      }
    }

    // Apply polygon offset to avoid z-fighting
    // TODO - move to draw-layers
    const {getPolygonOffset} = this.props;
    const offsets = (getPolygonOffset && getPolygonOffset(uniforms)) || [0, 0];
    parameters.polygonOffset = offsets;

    // Call subclass lifecycle method
    withParameters(this.context.gl, parameters, () => {
      this.draw({moduleParameters, uniforms, parameters, context: this.context});
    });
    // End lifecycle method
  }

  // {uniforms = {}, ...opts}
  pickLayer(opts) {
    // Call subclass lifecycle method
    return this.getPickingInfo(opts);
    // End lifecycle method
  }

  // Helper methods
  getChangeFlags() {
    return this.internalState.changeFlags;
  }

  // Dirty some change flags, will be handled by updateLayer
  /* eslint-disable complexity */
  setChangeFlags(flags) {
    this.internalState.changeFlags = this.internalState.changeFlags || {};
    const changeFlags = this.internalState.changeFlags;

    // Update primary flags
    if (flags.dataChanged && !changeFlags.dataChanged) {
      changeFlags.dataChanged = flags.dataChanged;
      log.log(LOG_PRIORITY_UPDATE + 1, () => `dataChanged: ${flags.dataChanged} in ${this.id}`)();
    }
    if (flags.updateTriggersChanged && !changeFlags.updateTriggersChanged) {
      changeFlags.updateTriggersChanged =
        changeFlags.updateTriggersChanged && flags.updateTriggersChanged
          ? Object.assign({}, flags.updateTriggersChanged, changeFlags.updateTriggersChanged)
          : flags.updateTriggersChanged || changeFlags.updateTriggersChanged;
      log.log(
        LOG_PRIORITY_UPDATE + 1,
        () =>
          'updateTriggersChanged: ' +
          `${Object.keys(flags.updateTriggersChanged).join(', ')} in ${this.id}`
      )();
    }
    if (flags.propsChanged && !changeFlags.propsChanged) {
      changeFlags.propsChanged = flags.propsChanged;
      log.log(LOG_PRIORITY_UPDATE + 1, () => `propsChanged: ${flags.propsChanged} in ${this.id}`)();
    }
    if (flags.viewportChanged && !changeFlags.viewportChanged) {
      changeFlags.viewportChanged = flags.viewportChanged;
      log.log(
        LOG_PRIORITY_UPDATE + 2,
        () => `viewportChanged: ${flags.viewportChanged} in ${this.id}`
      )();
    }
    if (flags.stateChanged && !changeFlags.stateChanged) {
      changeFlags.stateChanged = flags.stateChanged;
      log.log(LOG_PRIORITY_UPDATE + 1, () => `stateChanged: ${flags.stateChanged} in ${this.id}`)();
    }

    // Update composite flags
    const propsOrDataChanged =
      flags.dataChanged || flags.updateTriggersChanged || flags.propsChanged;
    changeFlags.propsOrDataChanged = changeFlags.propsOrDataChanged || propsOrDataChanged;
    changeFlags.somethingChanged =
      changeFlags.somethingChanged ||
      propsOrDataChanged ||
      flags.viewportChanged ||
      flags.stateChanged;
  }
  /* eslint-enable complexity */

  // Clear all changeFlags, typically after an update
  clearChangeFlags() {
    this.internalState.changeFlags = {
      // Primary changeFlags, can be strings stating reason for change
      dataChanged: false,
      propsChanged: false,
      updateTriggersChanged: false,
      viewportChanged: false,
      stateChanged: false,

      // Derived changeFlags
      propsOrDataChanged: false,
      somethingChanged: false
    };
  }

  printChangeFlags() {
    const flags = this.internalState.changeFlags;
    return `\
${flags.dataChanged ? 'data ' : ''}\
${flags.propsChanged ? 'props ' : ''}\
${flags.updateTriggersChanged ? 'triggers ' : ''}\
${flags.viewportChanged ? 'viewport' : ''}\
`;
  }

  // Compares the layers props with old props from a matched older layer
  // and extracts change flags that describe what has change so that state
  // can be update correctly with minimal effort
  diffProps(newProps, oldProps) {
    const changeFlags = diffProps(newProps, oldProps);

    // iterate over changedTriggers
    if (changeFlags.updateTriggersChanged) {
      for (const key in changeFlags.updateTriggersChanged) {
        if (changeFlags.updateTriggersChanged[key]) {
          this._activeUpdateTrigger(key);
        }
      }
    }

    return this.setChangeFlags(changeFlags);
  }

  // Called by layer manager to validate props (in development)
  validateProps() {
    validateProps(this.props);
  }

  setModuleParameters(moduleParameters) {
    for (const model of this.getModels()) {
      model.updateModuleSettings(moduleParameters);
    }
  }

  // PRIVATE METHODS

  _getUpdateParams() {
    return {
      props: this.props,
      oldProps: this.internalState.getOldProps(),
      context: this.context,
      changeFlags: this.internalState.changeFlags
    };
  }

  // Checks state of attributes and model
  _getNeedsRedraw(opts) {
    // this method may be called by the render loop as soon a the layer
    // has been created, so guard against uninitialized state
    if (!this.internalState) {
      return false;
    }

    let redraw = false;
    redraw = redraw || (this.internalState.needsRedraw && this.id);
    this.internalState.needsRedraw = this.internalState.needsRedraw && !opts.clearRedrawFlags;

    // TODO - is attribute manager needed? - Model should be enough.
    const attributeManager = this.getAttributeManager();
    const attributeManagerNeedsRedraw = attributeManager && attributeManager.getNeedsRedraw(opts);
    redraw = redraw || attributeManagerNeedsRedraw;

    return redraw;
  }

  // Create new attribute manager
  _getAttributeManager() {
    return new AttributeManager(this.context.gl, {
      id: this.props.id,
      stats: this.context.stats
    });
  }

  _initState() {
    assert(!this.internalState && !this.state);

    const attributeManager = this._getAttributeManager();

    if (attributeManager) {
      // All instanced layers get instancePickingColors attribute by default
      // Their shaders can use it to render a picking scene
      // TODO - this slightly slows down non instanced layers
      attributeManager.addInstanced({
        instancePickingColors: {
          type: GL.UNSIGNED_BYTE,
          size: 3,
          update: this.calculateInstancePickingColors
        }
      });
    }

    this.internalState = new LayerState({
      attributeManager,
      layer: this
    });

    this.state = {};
    // TODO deprecated, for backwards compatibility with older layers
    this.state.attributeManager = attributeManager;

    this.internalState.onAsyncPropUpdated = this._onAsyncPropUpdated.bind(this);

    // Ensure any async props are updated
    this.internalState.setAsyncProps(this.props);
  }

  // Called by layer manager to transfer state from an old layer
  _transferState(oldLayer) {
    const {state, internalState} = oldLayer;
    assert(state && internalState);

    if (this === oldLayer) {
      return;
    }

    // Move internalState
    this.internalState = internalState;
    this.internalState.component = this;

    // Move state
    this.state = state;
    // Deprecated: layer references on `state`
    state.layer = this;
    // We keep the state ref on old layers to support async actions
    // oldLayer.state = null;

    // Ensure any async props are updated
    this.internalState.setAsyncProps(this.props);

    // Update model layer reference
    for (const model of this.getModels()) {
      model.userData.layer = this;
    }

    this.diffProps(this.props, this.internalState.getOldProps());
  }

  _onAsyncPropUpdated() {
    this.diffProps(this.props, this.internalState.getOldProps());
    this.setLayerNeedsUpdate();
  }

  // Operate on each changed triggers, will be called when an updateTrigger changes
  _activeUpdateTrigger(propName) {
    this.invalidateAttribute(propName);
  }

  _updateBaseUniforms() {
    const uniforms = {
      // apply gamma to opacity to make it visually "linear"
      opacity:
        typeof this.props.opacity === 'function'
          ? animationProps => Math.pow(this.props.opacity(animationProps), 1 / 2.2)
          : Math.pow(this.props.opacity, 1 / 2.2)
    };
    for (const model of this.getModels()) {
      model.setUniforms(uniforms);
    }
  }

  // DEPRECATED METHODS

  // Updates selected state members and marks the object for redraw
  setUniforms(uniformMap) {
    for (const model of this.getModels()) {
      model.setUniforms(uniformMap);
    }

    // TODO - set needsRedraw on the model(s)?
    this.setNeedsRedraw();
    log.deprecated('layer.setUniforms', 'model.setUniforms')();
  }

  is64bitEnabled() {
    log.deprecated('is64bitEnabled', 'use64bitProjection')();
    return this.use64bitProjection();
  }
}

Layer.layerName = 'Layer';
Layer.defaultProps = defaultProps;
