/* eslint-disable complexity */
import assert from '../utils/assert';
import {Buffer} from '../webgl';
import GL from '../constants';

export default class Attribute {
  constructor(gl, opts = {}) {
    const {
      id = 'unnamed-attribute',
      type,
      isIndexed = false
    } = opts;

    // Options that cannot be changed later
    this.gl = gl;
    this.id = id;
    this.isIndexed = isIndexed;
    this.target = isIndexed ? GL.ELEMENT_ARRAY_BUFFER : GL.ARRAY_BUFFER;
    this.type = type;

    // Initialize the attribute descriptor, with WebGL and metadata fields
    this.value = null;
    this.externalBuffer = null;
    this.buffer = null;
    this.userData = {}; // Reserved for application
    this.update(opts);

    // Sanity - no app fields on our attributes. Use userData instead.
    Object.seal(this);

    // Check all fields and generate helpful error messages
    this._validateAttributeDefinition();
  }

  delete() {
    if (this.buffer) {
      this.buffer.delete();
      this.buffer = null;
    }
  }

  update({
    value,
    buffer,

    // buffer options
    size = this.size,
    offset = this.offset || 0,
    stride = this.stride || 0,
    normalized = this.normalized || false,
    integer = this.integer || false,
    instanced = this.instanced || 0,

    isGeneric = this.isGeneric || false,
    isInstanced
  }) {

    this.size = size;
    this.offset = offset;
    this.stride = stride;
    this.normalized = normalized;
    this.integer = integer;
    this.isGeneric = isGeneric;

    if (isInstanced !== undefined) {
      this.instanced = isInstanced ? 1 : 0;
    } else {
      this.instanced = instanced;
    }

    if (buffer) {
      this.externalBuffer = buffer;
      this.type = buffer.type;
    } else if (value) {
      this.externalBuffer = null;
      this.value = value;

      if (!isGeneric) {
        // Create buffer if needed
        this.buffer = this.buffer || new Buffer(this.gl, {
          target: this.target,
          type: this.type
        });
        this.buffer.setData({data: value});
        this.type = this.buffer.type;
      }
    }
  }

  getBuffer() {
    if (this.isGeneric) {
      return null;
    }
    return this.externalBuffer || this.buffer;
  }

  _validateAttributeDefinition() {
    assert(
      this.size >= 1 && this.size <= 4,
      `Attribute definition for ${this.id} invalid size`
    );
  }
}
