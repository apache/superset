/* eslint-disable camelcase */
import {decomposeCompositeGLType} from '../webgl-utils/attribute-utils';
import {assert} from '../utils';

const ERR_ARGUMENT = 'UniformBufferLayout illegal argument';

// Local constants - these will "collapse" during minification
const GL_FLOAT = 0x1406;
const GL_INT = 0x1404;
const GL_UNSIGNED_INT = 0x1405;

// Std140 layout for uniforms
export default class UniformBufferLayout {
  constructor(layout) {
    this.layout = {};
    this.size = 0;

    // Add layout (type, size and offset) definitions for each uniform in the layout
    for (const key in layout) {
      this._addUniform(key, layout[key]);
    }

    this.size += (4 - (this.size % 4)) % 4;

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
    const typeAndComponents = decomposeCompositeGLType(uniformType);
    assert(typeAndComponents, ERR_ARGUMENT);
    const {type, components: count} = typeAndComponents;

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
      case 1:
        return size; // Pad upwards to even multiple of 2
      case 2:
        return size + (size % 2); // Pad upwards to even multiple of 2
      default:
        return size + ((4 - (size % 4)) % 4); // Pad upwards to even multiple of 4
    }
  }
}
