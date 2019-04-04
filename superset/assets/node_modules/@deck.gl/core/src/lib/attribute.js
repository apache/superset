/* eslint-disable complexity */
import assert from '../utils/assert';
import {GL, Buffer, experimental} from 'luma.gl';
const {Attribute} = experimental;
const DEFAULT_STATE = {
  isExternalBuffer: false,
  needsAlloc: false,
  needsUpdate: false,
  needsRedraw: false,
  allocedInstances: -1
};

export default class LayerAttribute extends Attribute {
  constructor(gl, opts = {}) {
    super(gl, opts);

    const {
      // deck.gl fields
      transition = false,
      noAlloc = false,
      update = null,
      accessor = null
    } = opts;

    let {defaultValue = [0, 0, 0, 0]} = opts;
    defaultValue = Array.isArray(defaultValue) ? defaultValue : [defaultValue];

    Object.assign(this.userData, DEFAULT_STATE, opts, {
      transition,
      noAlloc,
      update,
      accessor,
      defaultValue
    });

    Object.seal(this.userData);

    // Check all fields and generate helpful error messages
    this._validateAttributeUpdaters();
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
    return [this.id].concat(accessor || []);
  }

  supportsTransition() {
    return this.userData.transition;
  }

  // Checks that typed arrays for attributes are big enough
  // sets alloc flag if not
  // @return {Boolean} whether any updates are needed
  setNeedsUpdate(reason = this.id) {
    this.userData.needsUpdate = this.userData.needsUpdate || reason;
  }

  setNeedsRedraw(reason = this.id) {
    this.userData.needsRedraw = this.userData.needsRedraw || reason;
  }

  setNumInstances(numInstances) {
    const state = this.userData;

    if (state.isExternalBuffer || state.noAlloc) {
      // Data is provided through a Buffer object.
      return;
    }
    // Do we need to reallocate the attribute's typed array?
    const instanceCount = this.getInstanceCount();
    const needsAlloc = instanceCount === 0 || instanceCount < numInstances;
    if (needsAlloc && (state.update || state.accessor)) {
      state.needsAlloc = true;
      this.setNeedsUpdate(this.id);
    }
  }

  allocate(numInstances) {
    this.setNumInstances(numInstances);

    const state = this.userData;

    // Allocate a new typed array if needed
    if (state.needsAlloc) {
      // Allocate at least one element to ensure a valid buffer
      const allocCount = Math.max(numInstances, 1);
      const ArrayType = glArrayFromType(this.type || GL.FLOAT);

      this.isGeneric = false;
      this.value = new ArrayType(this.size * allocCount);
      state.needsAlloc = false;
      state.needsUpdate = true;

      state.allocedInstances = allocCount;
      return true;
    }

    return false;
  }

  updateBuffer({numInstances, data, props, context}) {
    if (!this.needsUpdate()) {
      return false;
    }

    const state = this.userData;

    const {update, accessor} = state;

    let updated = true;
    if (update) {
      // Custom updater - typically for non-instanced layers
      update.call(context, this, {data, props, numInstances});
      this.update({
        value: this.value,
        isGeneric: this.isGeneric
      });
      this._checkAttributeArray();
    } else if (accessor) {
      // Standard updater
      this._updateBufferViaStandardAccessor(data, props);
      this._checkAttributeArray();
    } else {
      updated = false;
    }

    state.needsUpdate = false;
    state.needsRedraw = true;

    return updated;
  }

  setGenericValue({props}) {
    const state = this.userData;
    let value = props[state.accessor];

    if (value === undefined || typeof value === 'function') {
      // ignore if this attribute has no accessor
      // ignore if accessor is function, will be used in updateBuffer
      return;
    }

    value = this._normalizeValue(value);
    const hasChanged = !this.isGeneric || !this._areValuesEqual(value, this.value);

    if (hasChanged) {
      this.update({isGeneric: true, value});
    }
    state.needsRedraw = state.needsUpdate || hasChanged;
    state.needsUpdate = false;
    state.isExternalBuffer = true;
  }

  setExternalBuffer(buffer, numInstances) {
    const state = this.userData;

    if (buffer) {
      state.isExternalBuffer = true;
      state.needsUpdate = false;

      if (buffer instanceof Buffer) {
        if (this.externalBuffer !== buffer) {
          this.update({isGeneric: false, buffer});
          state.needsRedraw = true;
        }
      } else {
        const ArrayType = glArrayFromType(this.type || GL.FLOAT);
        if (!(buffer instanceof ArrayType)) {
          throw new Error(`Attribute ${this.id} must be of type ${ArrayType.name}`);
        }
        if (state.auto && buffer.length <= numInstances * this.size) {
          throw new Error('Attribute prop array must match length and size');
        }
        if (this.value !== buffer) {
          this.update({value: buffer});
          state.needsRedraw = true;
        }
      }
    } else {
      state.isExternalBuffer = false;
    }
  }

  // PRIVATE HELPER METHODS

  /* check user supplied values and apply fallback */
  _normalizeValue(value, size = this.size, defaultValue = this.userData.defaultValue) {
    if (!Array.isArray(value) && !ArrayBuffer.isView(value)) {
      value = [value];
    }

    /* eslint-disable no-fallthrough, default-case */
    switch (size) {
      case 4:
        value[3] = Number.isFinite(value[3]) ? value[3] : defaultValue[3];
      case 3:
        value[2] = Number.isFinite(value[2]) ? value[2] : defaultValue[2];
      case 2:
        value[1] = Number.isFinite(value[1]) ? value[1] : defaultValue[1];
      case 1:
        value[0] = Number.isFinite(value[0]) ? value[0] : defaultValue[0];
    }

    return value;
  }

  _areValuesEqual(value1, value2, size = this.size) {
    for (let i = 0; i < size; i++) {
      if (value1[i] !== value2[i]) {
        return false;
      }
    }
    return true;
  }

  _updateBufferViaStandardAccessor(data, props) {
    const state = this.userData;

    const {accessor, defaultValue} = state;
    const {value, size} = this;
    const accessorFunc = props[accessor];

    assert(typeof accessorFunc === 'function', `accessor "${accessor}" is not a function`);

    let i = 0;
    for (const object of data) {
      let objectValue = accessorFunc(object);
      objectValue = this._normalizeValue(objectValue, size, defaultValue);
      for (let j = 0; j < size; j++) {
        value[i++] = objectValue[j];
      }
    }
    this.update({value});
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
