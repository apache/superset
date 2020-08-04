import GL from '@luma.gl/constants';
import {getTypedArrayFromGLType} from '../webgl-utils';
import {checkProps, assert} from '../utils';

const DEFAULT_ACCESSOR_VALUES = {
  offset: 0,
  stride: 0,
  type: GL.FLOAT,
  size: 1,
  divisor: 0,
  normalized: false,
  integer: false
};

const PROP_CHECKS = {
  deprecatedProps: {
    instanced: 'divisor',
    isInstanced: 'divisor'
  }
};

export default class Accessor {
  static getBytesPerElement(accessor) {
    // TODO: using `FLOAT` when type is not specified,
    // ensure this assumption is valid or force API to specify type.
    const ArrayType = getTypedArrayFromGLType(accessor.type || GL.FLOAT);
    return ArrayType.BYTES_PER_ELEMENT;
  }

  static getBytesPerVertex(accessor) {
    assert(accessor.size);
    // TODO: using `FLOAT` when type is not specified,
    // ensure this assumption is valid or force API to specify type.
    const ArrayType = getTypedArrayFromGLType(accessor.type || GL.FLOAT);
    return ArrayType.BYTES_PER_ELEMENT * accessor.size;
  }

  // Combines (merges) a list of accessors. On top of default values
  // Usually [programAccessor, bufferAccessor, appAccessor]
  // All props will be set in the returned object.
  // TODO check for conflicts between values in the supplied accessors
  static resolve(...accessors) {
    return new Accessor(...[DEFAULT_ACCESSOR_VALUES, ...accessors]); // Default values
  }

  constructor(...accessors) {
    accessors.forEach(accessor => this._assign(accessor)); // Merge in sequence
    Object.freeze(this);
  }

  toString() {
    return JSON.stringify(this);
  }

  // ACCESSORS

  // TODO - remove>
  get BYTES_PER_ELEMENT() {
    return Accessor.getBytesPerElement(this);
  }

  get BYTES_PER_VERTEX() {
    return Accessor.getBytesPerVertex(this);
  }

  // PRIVATE

  // eslint-disable-next-line complexity, max-statements
  _assign(props = {}) {
    props = checkProps('Accessor', props, PROP_CHECKS);

    if (props.type !== undefined) {
      this.type = props.type;

      // Auto-deduce integer type?
      if (props.type === GL.INT || props.type === GL.UNSIGNED_INT) {
        this.integer = true;
      }
    }
    if (props.size !== undefined) {
      this.size = props.size;
    }
    if (props.offset !== undefined) {
      this.offset = props.offset;
    }
    if (props.stride !== undefined) {
      this.stride = props.stride;
    }
    if (props.normalized !== undefined) {
      this.normalized = props.normalized;
    }
    if (props.integer !== undefined) {
      this.integer = props.integer;
    }

    // INSTANCE DIVISOR
    if (props.divisor !== undefined) {
      this.divisor = props.divisor;
    }

    // Buffer is optional
    if (props.buffer !== undefined) {
      this.buffer = props.buffer;
    }

    // The binding index (for binding e.g. Transform feedbacks and Uniform buffers)
    // TODO - should this be part of accessor?
    if (props.index !== undefined) {
      if (typeof index === 'boolean') {
        this.index = props.index ? 1 : 0;
      } else {
        this.index = props.index;
      }
    }

    // DEPRECATED
    if (props.instanced !== undefined) {
      this.divisor = props.instanced ? 1 : 0;
    }
    if (props.isInstanced !== undefined) {
      this.divisor = props.isInstanced ? 1 : 0;
    }

    return this;
  }
}

// TEST EXPORTS
export {DEFAULT_ACCESSOR_VALUES};
