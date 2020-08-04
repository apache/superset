/* eslint-disable complexity */
import GL from '@luma.gl/constants';
import {Buffer} from '@luma.gl/core';
import assert from '../utils/assert';
import {createIterable} from '../utils/iterable-utils';
import {fillArray} from '../utils/flatten';
import * as range from '../utils/range';
import log from '../utils/log';
import BaseAttribute from './base-attribute';

const DEFAULT_STATE = {
  isExternalBuffer: false,
  needsUpdate: true,
  needsRedraw: false,
  updateRanges: range.FULL,
  allocedInstances: -1
};

export default class Attribute extends BaseAttribute {
  constructor(gl, opts = {}) {
    super(gl, opts);

    const {
      // deck.gl fields
      transition = false,
      noAlloc = false,
      update = null,
      accessor = null,
      bufferLayout = null
    } = opts;

    let {defaultValue = [0, 0, 0, 0]} = opts;
    defaultValue = Array.isArray(defaultValue) ? defaultValue : [defaultValue];

    this.shaderAttributes = {};
    this.hasShaderAttributes = false;

    if (opts.shaderAttributes) {
      const shaderAttributes = opts.shaderAttributes;
      for (const shaderAttributeName in shaderAttributes) {
        const shaderAttribute = shaderAttributes[shaderAttributeName];

        // Initialize the attribute descriptor, with WebGL and metadata fields
        this.shaderAttributes[shaderAttributeName] = new Attribute(
          this.gl,
          Object.assign({}, shaderAttribute, {
            id: shaderAttributeName,
            // Luma fields
            constant: shaderAttribute.constant || false,
            isIndexed: shaderAttribute.isIndexed || shaderAttribute.elements,
            size: (shaderAttribute.elements && 1) || shaderAttribute.size || this.size,
            value: shaderAttribute.value || null,
            divisor: shaderAttribute.instanced || shaderAttribute.divisor || this.divisor,
            buffer: this.getBuffer(),
            noAlloc: true
          })
        );

        this.hasShaderAttributes = true;
      }
    }

    Object.assign(this.userData, DEFAULT_STATE, opts, {
      transition,
      noAlloc,
      update: update || (accessor && this._standardAccessor),
      accessor,
      defaultValue,
      bufferLayout
    });

    Object.seal(this.userData);

    // Check all fields and generate helpful error messages
    this._validateAttributeUpdaters();
  }

  get bufferLayout() {
    return this.userData.bufferLayout;
  }

  set bufferLayout(layout) {
    this.userData.bufferLayout = layout;
  }

  needsUpdate() {
    return this.userData.needsUpdate;
  }

  needsRedraw({clearChangedFlags = false} = {}) {
    const needsRedraw = this.userData.needsRedraw;
    this.userData.needsRedraw = this.userData.needsRedraw && !clearChangedFlags;
    return needsRedraw;
  }

  getInstanceCount() {
    return this.value !== null ? this.value.length / this.size : 0;
  }

  getUpdateTriggers() {
    const {accessor} = this.userData;

    // Backards compatibility: allow attribute name to be used as update trigger key
    return [this.id].concat((typeof accessor !== 'function' && accessor) || []);
  }

  getAccessor() {
    return this.userData.accessor;
  }

  getShaderAttributes() {
    const shaderAttributes = {};
    if (this.hasShaderAttributes) {
      Object.assign(shaderAttributes, this.shaderAttributes);
    } else {
      shaderAttributes[this.id] = this;
    }

    return shaderAttributes;
  }

  supportsTransition() {
    return this.userData.transition;
  }

  // Resolve transition settings object if transition is enabled, otherwise `null`
  getTransitionSetting(opts) {
    const {transition, accessor} = this.userData;
    if (!transition) {
      return null;
    }
    let settings = Array.isArray(accessor) ? opts[accessor.find(a => opts[a])] : opts[accessor];

    // Shorthand: use duration instead of parameter object
    if (Number.isFinite(settings)) {
      settings = {duration: settings};
    }

    if (settings && settings.duration > 0) {
      return Object.assign({}, transition, settings);
    }

    return null;
  }

  setNeedsUpdate(reason = this.id, dataRange) {
    this.userData.needsUpdate = this.userData.needsUpdate || reason;
    if (dataRange) {
      const {startRow = 0, endRow = Infinity} = dataRange;
      this.userData.updateRanges = range.add(this.userData.updateRanges, [startRow, endRow]);
    } else {
      this.userData.updateRanges = range.FULL;
    }
  }

  clearNeedsUpdate() {
    this.userData.needsUpdate = false;
    this.userData.updateRanges = range.EMPTY;
  }

  setNeedsRedraw(reason = this.id) {
    this.userData.needsRedraw = this.userData.needsRedraw || reason;
  }

  allocate(numInstances) {
    const state = this.userData;

    if (state.isExternalBuffer || state.noAlloc) {
      // Data is provided through a Buffer object.
      return false;
    }

    // Do we need to reallocate the attribute's typed array?
    const instanceCount = this.getInstanceCount();
    const needsAlloc = instanceCount === 0 || instanceCount < numInstances;
    if (needsAlloc && (state.update || state.accessor)) {
      assert(Number.isFinite(numInstances));
      // Allocate at least one element to ensure a valid buffer
      const allocCount = Math.max(numInstances, 1);
      const ArrayType = glArrayFromType(this.type || GL.FLOAT);
      const oldValue = this.value;

      this.constant = false;
      this.value = new ArrayType(this.size * allocCount);

      if (this.buffer && this.buffer.byteLength < this.value.byteLength) {
        this.buffer.reallocate(this.value.byteLength);
      }

      if (state.updateRanges !== range.FULL) {
        this.value.set(oldValue);
        // Upload the full existing attribute value to the GPU, so that updateBuffer
        // can choose to only update a partial range.
        // TODO - copy old buffer to new buffer on the GPU
        this.buffer.subData(oldValue);
      }

      this.setNeedsUpdate(true, {startRow: instanceCount});
      state.allocedInstances = allocCount;
      return true;
    }

    return false;
  }

  updateBuffer({numInstances, bufferLayout, data, props, context}) {
    if (!this.needsUpdate()) {
      return false;
    }

    const state = this.userData;

    const {update, updateRanges, noAlloc} = state;

    let updated = true;
    if (update) {
      // Custom updater - typically for non-instanced layers
      for (const [startRow, endRow] of updateRanges) {
        update.call(context, this, {data, startRow, endRow, props, numInstances, bufferLayout});
      }
      if (this.constant || !this.buffer || this.buffer.byteLength < this.value.byteLength) {
        // call base clas `update` method to upload value to GPU
        this.update({
          value: this.value,
          constant: this.constant
        });
      } else {
        for (const [startRow, endRow] of updateRanges) {
          const startOffset = Number.isFinite(startRow)
            ? this._getVertexOffset(startRow, this.bufferLayout)
            : 0;
          const endOffset = Number.isFinite(endRow)
            ? this._getVertexOffset(endRow, this.bufferLayout)
            : noAlloc || !Number.isFinite(numInstances)
              ? this.value.length
              : numInstances * this.size;

          // Only update the changed part of the attribute
          this.buffer.subData({
            data: this.value.subarray(startOffset, endOffset),
            offset: startOffset * this.value.BYTES_PER_ELEMENT
          });
        }
      }
      this._checkAttributeArray();
    } else {
      updated = false;
    }

    this._updateShaderAttributes();

    this.clearNeedsUpdate();
    state.needsRedraw = true;

    return updated;
  }

  update(props) {
    super.update(props);
    this._updateShaderAttributes();
  }

  // Use generic value
  // Returns true if successful
  setGenericValue(value) {
    const state = this.userData;

    if (value === undefined || typeof value === 'function') {
      // ignore if this attribute has no accessor
      // ignore if accessor is function, will be used in updateBuffer
      state.isExternalBuffer = false;
      return false;
    }

    value = this._normalizeValue(value);
    const hasChanged = !this.constant || !this._areValuesEqual(value, this.value);

    if (hasChanged) {
      this.update({constant: true, value});
    }
    state.needsRedraw = state.needsUpdate || hasChanged;
    this.clearNeedsUpdate();
    state.isExternalBuffer = true;
    this._updateShaderAttributes();
    return true;
  }

  // Use external buffer
  // Returns true if successful
  setExternalBuffer(buffer, numInstances) {
    const state = this.userData;

    if (buffer) {
      state.isExternalBuffer = true;
      this.clearNeedsUpdate();

      if (buffer instanceof Buffer) {
        if (this.externalBuffer !== buffer) {
          this.update({constant: false, buffer});
          state.needsRedraw = true;
        }
      } else if (this.value !== buffer) {
        if (!ArrayBuffer.isView(buffer)) {
          throw new Error('Attribute prop must be typed array');
        }
        if (state.auto && buffer.length <= numInstances * this.size) {
          throw new Error('Attribute prop array must match length and size');
        }

        const ArrayType = glArrayFromType(this.type || GL.FLOAT);
        if (buffer instanceof ArrayType) {
          this.update({constant: false, value: buffer});
        } else {
          log.warn(`Attribute prop ${this.id} is casted to ${ArrayType.name}`)();
          // Cast to proper type
          this.update({constant: false, value: new ArrayType(buffer)});
        }
        // Save original typed array
        this.value = buffer;
        state.needsRedraw = true;
      }
      this._updateShaderAttributes();
      return true;
    }

    state.isExternalBuffer = false;
    return false;
  }

  // PRIVATE HELPER METHODS
  _getVertexOffset(row, bufferLayout) {
    if (bufferLayout) {
      let offset = 0;
      let index = 0;
      for (const geometrySize of bufferLayout) {
        if (index >= row) {
          break;
        }
        offset += geometrySize * this.size;
        index++;
      }
      return offset;
    }
    return row * this.size;
  }

  /* check user supplied values and apply fallback */
  _normalizeValue(value, out = [], start = 0) {
    const {defaultValue} = this.userData;

    if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
      out[start] = Number.isFinite(value) ? value : defaultValue[0];
      return out;
    }

    /* eslint-disable no-fallthrough, default-case */
    switch (this.size) {
      case 4:
        out[start + 3] = Number.isFinite(value[3]) ? value[3] : defaultValue[3];
      case 3:
        out[start + 2] = Number.isFinite(value[2]) ? value[2] : defaultValue[2];
      case 2:
        out[start + 1] = Number.isFinite(value[1]) ? value[1] : defaultValue[1];
      case 1:
        out[start + 0] = Number.isFinite(value[0]) ? value[0] : defaultValue[0];
    }

    return out;
  }

  _areValuesEqual(value1, value2, size = this.size) {
    for (let i = 0; i < size; i++) {
      if (value1[i] !== value2[i]) {
        return false;
      }
    }
    return true;
  }

  _standardAccessor(attribute, {data, startRow, endRow, props, numInstances, bufferLayout}) {
    const state = attribute.userData;

    const {accessor} = state;
    const {value, size} = attribute;
    const accessorFunc = typeof accessor === 'function' ? accessor : props[accessor];

    assert(typeof accessorFunc === 'function', `accessor "${accessor}" is not a function`);

    let i = attribute._getVertexOffset(startRow, bufferLayout);
    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    for (const object of iterable) {
      objectInfo.index++;

      const objectValue = accessorFunc(object, objectInfo);

      if (bufferLayout) {
        attribute._normalizeValue(objectValue, objectInfo.target);
        const numVertices = bufferLayout[objectInfo.index];
        fillArray({
          target: attribute.value,
          source: objectInfo.target,
          start: i,
          count: numVertices
        });
        i += numVertices * size;
      } else {
        attribute._normalizeValue(objectValue, value, i);
        i += size;
      }
    }
    attribute.constant = false;
    attribute.bufferLayout = bufferLayout;
  }

  // Validate deck.gl level fields
  _validateAttributeUpdaters() {
    const state = this.userData;

    // Check that either 'accessor' or 'update' is a valid function
    const hasUpdater =
      state.noAlloc || typeof state.update === 'function' || typeof state.accessor === 'string';
    if (!hasUpdater) {
      throw new Error(`Attribute ${this.id} missing update or accessor`);
    }
  }

  _checkAttributeArray() {
    const {value} = this;
    if (value && value.length >= 4) {
      const valid =
        Number.isFinite(value[0]) &&
        Number.isFinite(value[1]) &&
        Number.isFinite(value[2]) &&
        Number.isFinite(value[3]);
      if (!valid) {
        throw new Error(`Illegal attribute generated for ${this.id}`);
      }
    }
  }

  _updateShaderAttributes() {
    const shaderAttributes = this.shaderAttributes;
    for (const shaderAttributeName in shaderAttributes) {
      const shaderAttribute = shaderAttributes[shaderAttributeName];
      shaderAttribute.update({
        buffer: this.getBuffer(),
        value: this.value,
        constant: this.constant
      });
    }
  }
}

/* eslint-disable complexity */
export function glArrayFromType(glType, {clamped = true} = {}) {
  // Sorted in some order of likelihood to reduce amount of comparisons
  switch (glType) {
    case GL.FLOAT:
      return Float32Array;
    case GL.UNSIGNED_SHORT:
    case GL.UNSIGNED_SHORT_5_6_5:
    case GL.UNSIGNED_SHORT_4_4_4_4:
    case GL.UNSIGNED_SHORT_5_5_5_1:
      return Uint16Array;
    case GL.UNSIGNED_INT:
      return Uint32Array;
    case GL.UNSIGNED_BYTE:
      return clamped ? Uint8ClampedArray : Uint8Array;
    case GL.BYTE:
      return Int8Array;
    case GL.SHORT:
      return Int16Array;
    case GL.INT:
      return Int32Array;
    default:
      throw new Error('Failed to deduce type from array');
  }
}
/* eslint-enable complexity */
