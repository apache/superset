/* eslint-disable camelcase */
import assert from '../utils/assert';

const ERR_ARGUMENT = 'UniformBufferLayout illegal argument';

// Local constants - these will "collapse" during minification
const GL_INT = 0x1404;
const GL_INT_VEC2 = 0x8B53;
const GL_INT_VEC3 = 0x8B54;
const GL_INT_VEC4 = 0x8B55;

const GL_FLOAT = 0x1406;
const GL_FLOAT_VEC2 = 0x8B50;
const GL_FLOAT_VEC3 = 0x8B51;
const GL_FLOAT_VEC4 = 0x8B52;

const GL_BOOL = 0x8B56;
const GL_BOOL_VEC2 = 0x8B57;
const GL_BOOL_VEC3 = 0x8B58;
const GL_BOOL_VEC4 = 0x8B59;

const GL_UNSIGNED_INT = 0x1405;
const GL_UNSIGNED_INT_VEC2 = 0x8DC6;
const GL_UNSIGNED_INT_VEC3 = 0x8DC7;
const GL_UNSIGNED_INT_VEC4 = 0x8DC8;

const GL_FLOAT_MAT2 = 0x8B5A;
const GL_FLOAT_MAT3 = 0x8B5B;
const GL_FLOAT_MAT4 = 0x8B5C;

const GL_FLOAT_MAT2x3 = 0x8B65;
const GL_FLOAT_MAT2x4 = 0x8B66;
const GL_FLOAT_MAT3x2 = 0x8B67;
const GL_FLOAT_MAT3x4 = 0x8B68;
const GL_FLOAT_MAT4x2 = 0x8B69;
const GL_FLOAT_MAT4x3 = 0x8B6A;

// Uniform table for std140
const UNIFORM_TYPES = {
  // No samplers in uniform blocks

  [GL_FLOAT]: [GL_FLOAT, 1],
  [GL_FLOAT_VEC2]: [GL_FLOAT, 2],
  [GL_FLOAT_VEC3]: [GL_FLOAT, 3],
  [GL_FLOAT_VEC4]: [GL_FLOAT, 4],

  [GL_INT]: [GL_INT, 1],
  [GL_INT_VEC2]: [GL_INT, 2],
  [GL_INT_VEC3]: [GL_INT, 3],
  [GL_INT_VEC4]: [GL_INT, 4],

  [GL_UNSIGNED_INT]: [GL_UNSIGNED_INT, 1],
  [GL_UNSIGNED_INT_VEC2]: [GL_UNSIGNED_INT, 2],
  [GL_UNSIGNED_INT_VEC3]: [GL_UNSIGNED_INT, 3],
  [GL_UNSIGNED_INT_VEC4]: [GL_UNSIGNED_INT, 4],

  [GL_BOOL]: [GL_FLOAT, 1],
  [GL_BOOL_VEC2]: [GL_FLOAT, 2],
  [GL_BOOL_VEC3]: [GL_FLOAT, 3],
  [GL_BOOL_VEC4]: [GL_FLOAT, 4],

  [GL_FLOAT_MAT2]: [GL_FLOAT, 8], // 4
  [GL_FLOAT_MAT2x3]: [GL_FLOAT, 8], // 6
  [GL_FLOAT_MAT2x4]: [GL_FLOAT, 8], // 8

  [GL_FLOAT_MAT3]: [GL_FLOAT, 12], // 9
  [GL_FLOAT_MAT3x2]: [GL_FLOAT, 12], // 6
  [GL_FLOAT_MAT3x4]: [GL_FLOAT, 12], // 12

  [GL_FLOAT_MAT4]: [GL_FLOAT, 16], // 16
  [GL_FLOAT_MAT4x2]: [GL_FLOAT, 16], // 8
  [GL_FLOAT_MAT4x3]: [GL_FLOAT, 16] // 12
};

// Std140 layout for uniforms
export default class UniformBufferLayout {
  constructor(layout) {
    this.layout = {};
    this.size = 0;

    // Add layout (type, size and offset) definitions for each uniform in the layout
    for (const key in layout) {
      this._addUniform(key, layout[key]);
    }

    // Allocate three typed arrays pointing at same memory
    const data = new Float32Array(this.size);
    this.typedArray = {
      [GL_FLOAT]: data,
      [GL_INT]: new Int32Array(data.buffer),
      [GL_UNSIGNED_INT]: new Uint32Array(data.buffer)
    };
  }

  // Get number of bytes needed for buffer allocation
  getBytes() {
    return this.size * 4;
  }

  // Get the current data as Float32Array, for bufferSubData
  getData() {
    return this.typedArray[GL_FLOAT];
  }

  // Get offset and data for one object (for bufferSubData)
  getSubData(index) {
    let data;
    let offset;
    if (index === undefined) {
      data = this.data;
      offset = 0;
    } else {
      const begin = this.offsets[index];
      const end = begin + this.sizes[index];
      data = this.data.subarray(begin, end);
      offset = begin * 4;
    }
    return {data, offset};
  }

  // Set a map of values
  setUniforms(values) {
    for (const key in values) {
      this._setValue(key, values[key]);
    }
    return this;
  }

  _setValue(key, value) {
    const layout = this.layout[key];
    assert(layout, 'UniformLayoutStd140 illegal argument');
    const typedArray = this.typedArray[layout.type];
    if (layout.size === 1) {
      // single value -> just set it
      typedArray[layout.offset] = value;
    } else {
      // vector/matrix -> copy the supplied (typed) array, starting from offset
      typedArray.set(value, layout.offset);
    }
  }

  _addUniform(key, uniformType) {
    const definition = UNIFORM_TYPES[uniformType];
    assert(definition, ERR_ARGUMENT);
    const [type, count] = definition;

    // First, align (bump) current offset to an even multiple of current object (1, 2, 4)
    this.size = this._alignTo(this.size, count);
    // Use the aligned size as the offset of the current uniform.
    const offset = this.size;
    // Then, add our object's padded size ((1, 2, multiple of 4) to the current offset
    this.size += count;

    this.layout[key] = {type, size: count, offset};
  }

  // Align offset to 1, 2 or 4 elements (4, 8 or 16 bytes)
  _alignTo(size, count) {
    switch (count) {
    case 1: return size; // Pad upwards to even multiple of 2
    case 2: return size + size % 2; // Pad upwards to even multiple of 2
    default: return size + (4 - size % 4) % 4; // Pad upwards to even multiple of 4
    }
  }
}
