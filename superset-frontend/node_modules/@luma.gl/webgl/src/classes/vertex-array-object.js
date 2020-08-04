import GL from '@luma.gl/constants';
import Resource from './resource';
import Buffer from './buffer';
import {isWebGL2} from '../webgl-utils';
import {getScratchArray, fillArray} from '../utils/array-utils-flat';
import {assert} from '../utils';
import {getBrowser} from 'probe.gl';

/* eslint-disable camelcase */
const OES_vertex_array_object = 'OES_vertex_array_object';

const ERR_ELEMENTS = 'elements must be GL.ELEMENT_ARRAY_BUFFER';

export default class VertexArrayObject extends Resource {
  static isSupported(gl, options = {}) {
    // Attribute 0 can not be disable on most desktop OpenGL based browsers
    // and on iOS Safari browser.
    if (options.constantAttributeZero) {
      return isWebGL2(gl) || getBrowser() === 'Chrome';
    }

    // Whether additional objects can be created
    return isWebGL2(gl) || gl.getExtension(OES_vertex_array_object);
  }

  // Returns the global (null) vertex array object. Exists even when no extension available
  static getDefaultArray(gl) {
    gl.luma = gl.luma || {};
    if (!gl.luma.defaultVertexArray) {
      gl.luma.defaultVertexArray = new VertexArrayObject(gl, {handle: null, isDefaultArray: true});
    }
    return gl.luma.defaultVertexArray;
  }

  static getMaxAttributes(gl) {
    // TODO - should be cached per context
    VertexArrayObject.MAX_ATTRIBUTES =
      VertexArrayObject.MAX_ATTRIBUTES || gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
    return VertexArrayObject.MAX_ATTRIBUTES;
  }

  // Note: Constants are stored globally on the WebGL context, not the VAO
  // So they need to be updated before every render
  // TODO - use known type (in configuration or passed in) to allow non-typed arrays?
  // TODO - remember/cache values to avoid setting them unnecessarily?
  static setConstant(gl, location, array) {
    switch (array.constructor) {
      case Float32Array:
        VertexArrayObject._setConstantFloatArray(gl, location, array);
        break;
      case Int32Array:
        VertexArrayObject._setConstantIntArray(gl, location, array);
        break;
      case Uint32Array:
        VertexArrayObject._setConstantUintArray(gl, location, array);
        break;
      default:
        assert(false);
    }
  }

  // Create a VertexArray
  constructor(gl, opts = {}) {
    // Use program's id if program but no id is supplied
    const id = opts.id || (opts.program && opts.program.id);
    super(gl, Object.assign({}, opts, {id}));

    this.hasVertexArrays = VertexArrayObject.isSupported(gl);
    this.buffer = null;
    this.bufferValue = null;
    // this.isDefaultArray = opts.isDefaultArray || false;

    this.initialize(opts);

    Object.seal(this);
  }

  delete() {
    super.delete();
    if (this.buffer) {
      this.buffer.delete();
    }
  }

  get MAX_ATTRIBUTES() {
    return VertexArrayObject.getMaxAttributes(this.gl);
  }

  initialize(props = {}) {
    return this.setProps(props);
  }

  setProps(props) {
    // TODO: decide which props should be supported
    return this;
  }

  // Set (bind) an elements buffer, for indexed rendering.
  // Must be a Buffer bound to GL.ELEMENT_ARRAY_BUFFER. Constants not supported
  setElementBuffer(elementBuffer = null, opts = {}) {
    assert(!elementBuffer || elementBuffer.target === GL.ELEMENT_ARRAY_BUFFER, ERR_ELEMENTS);

    // The GL.ELEMENT_ARRAY_BUFFER_BINDING is stored on the VertexArrayObject...
    this.bind(() => {
      this.gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, elementBuffer ? elementBuffer.handle : null);
    });

    return this;
  }

  // Set a location in vertex attributes array to a bufferk, enables the location, sets divisor
  setBuffer(location, buffer, accessor) {
    // Check target
    if (buffer.target === GL.ELEMENT_ARRAY_BUFFER) {
      return this.setElementBuffer(buffer, accessor);
    }

    const {size, type, stride, offset, normalized, integer, divisor} = accessor;

    const {gl} = this;
    location = Number(location);

    this.bind(() => {
      // A non-zero buffer object must be bound to the GL_ARRAY_BUFFER target
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.handle);

      // WebGL2 supports *integer* data formats, i.e. GPU will see integer values
      if (integer) {
        assert(isWebGL2(gl));
        gl.vertexAttribIPointer(location, size, type, stride, offset);
      } else {
        // Attaches ARRAY_BUFFER with specified buffer format to location
        gl.vertexAttribPointer(location, size, type, normalized, stride, offset);
      }
      gl.enableVertexAttribArray(location);
      gl.vertexAttribDivisor(location, divisor || 0);

      // NOTE We don't unbind buffer here, typically another buffer will be bound just after
    });

    return this;
  }

  // Enabling an attribute location makes it reference the currently bound buffer
  // Disabling an attribute location makes it reference the global constant value
  // TODO - handle single values for size 1 attributes?
  // TODO - convert classic arrays based on known type?
  enable(location, enable = true) {
    // Attribute 0 cannot be disabled in most desktop OpenGL based browsers
    const disablingAttributeZero =
      !enable &&
      location === 0 &&
      !VertexArrayObject.isSupported(this.gl, {constantAttributeZero: true});

    if (!disablingAttributeZero) {
      location = Number(location);
      this.bind(
        () =>
          enable
            ? this.gl.enableVertexAttribArray(location)
            : this.gl.disableVertexAttribArray(location)
      );
    }
    return this;
  }

  // Provide a means to create a buffer that is equivalent to a constant.
  // NOTE: Desktop OpenGL cannot disable attribute 0.
  // https://stackoverflow.com/questions/20305231/webgl-warning-attribute-0-is-disabled-
  // this-has-significant-performance-penalt
  getConstantBuffer(elementCount, value, accessor) {
    // Create buffer only when needed, and reuse it (avoids inflating buffer creation statistics)

    const constantValue = this._normalizeConstantArrayValue(value, accessor);

    const byteLength = constantValue.byteLength * elementCount;
    const length = constantValue.length * elementCount;

    let updateNeeded = !this.buffer;

    this.buffer = this.buffer || new Buffer(this.gl, byteLength);
    updateNeeded = updateNeeded || this.buffer.reallocate(byteLength);

    // Reallocate and update contents if needed
    updateNeeded =
      updateNeeded || !this._compareConstantArrayValues(constantValue, this.bufferValue);

    if (updateNeeded) {
      // Create a typed array that is big enough, and fill it with the required data
      const typedArray = getScratchArray(value.constructor, length);
      fillArray({target: typedArray, source: constantValue, start: 0, count: length});
      this.buffer.subData(typedArray);
      this.bufferValue = value;
    }

    return this.buffer;
  }

  // PRIVATE

  // TODO - convert Arrays based on known type? (read type from accessor, don't assume Float32Array)
  // TODO - handle single values for size 1 attributes?
  _normalizeConstantArrayValue(arrayValue, accessor) {
    if (Array.isArray(arrayValue)) {
      return new Float32Array(arrayValue);
    }
    return arrayValue;
  }

  _compareConstantArrayValues(v1, v2) {
    if (!v1 || !v2 || v1.length !== v2.length || v1.constructor !== v2.constructor) {
      return false;
    }
    for (let i = 0; i < v1.length; ++i) {
      if (v1[i] !== v2[i]) {
        return false;
      }
    }
    return true;
  }

  static _setConstantFloatArray(gl, location, array) {
    switch (array.length) {
      case 1:
        gl.vertexAttrib1fv(location, array);
        break;
      case 2:
        gl.vertexAttrib2fv(location, array);
        break;
      case 3:
        gl.vertexAttrib3fv(location, array);
        break;
      case 4:
        gl.vertexAttrib4fv(location, array);
        break;
      default:
        assert(false);
    }
  }

  static _setConstantIntArray(gl, location, array) {
    assert(isWebGL2(gl));
    switch (array.length) {
      case 1:
        gl.vertexAttribI1iv(location, array);
        break;
      case 2:
        gl.vertexAttribI2iv(location, array);
        break;
      case 3:
        gl.vertexAttribI3iv(location, array);
        break;
      case 4:
        gl.vertexAttribI4iv(location, array);
        break;
      default:
        assert(false);
    }
  }

  static _setConstantUintArray(gl, location, array) {
    assert(isWebGL2(gl));
    switch (array.length) {
      case 1:
        gl.vertexAttribI1uiv(location, array);
        break;
      case 2:
        gl.vertexAttribI2uiv(location, array);
        break;
      case 3:
        gl.vertexAttribI3uiv(location, array);
        break;
      case 4:
        gl.vertexAttribI4uiv(location, array);
        break;
      default:
        assert(false);
    }
  }

  // RESOURCE IMPLEMENTATION

  _createHandle() {
    this.hasVertexArrays = VertexArrayObject.isSupported(this.gl);
    if (this.hasVertexArrays) {
      return this.gl.createVertexArray();
    }
    return null;
  }

  _deleteHandle(handle) {
    if (this.hasVertexArrays) {
      this.gl.deleteVertexArray(handle);
    }
    return [this.elements];
    // return [this.elements, ...this.buffers];
  }

  _bindHandle(handle) {
    if (this.hasVertexArrays) {
      this.gl.bindVertexArray(handle);
    }
  }

  // Generic getter for information about a vertex attribute at a given position
  _getParameter(pname, {location}) {
    assert(Number.isFinite(location));
    return this.bind(() => {
      switch (pname) {
        case GL.VERTEX_ATTRIB_ARRAY_POINTER:
          return this.gl.getVertexAttribOffset(location, pname);
        default:
          return this.gl.getVertexAttrib(location, pname);
      }
    });
  }

  // DEPRECATED

  /*
  setDivisor(location, divisor) {
    location = Number(location);
    this.bind(() => this.gl.vertexAttribDivisor(location, divisor));
    return this;
  }

  // match assumed WebGL defaults
  static resetConstants(gl) {
    const MAX_ATTRIBUTES = VertexArrayObject.getMaxAttributes(gl);
    for (let i = 0; i < MAX_ATTRIBUTES; i++) {
      VertexArrayObject.setConstant(gl, i, [0, 0, 0, 1]);
    }
  }

  // Resets all attributes (to default valued constants)
  resetAttributes() {
    // WebGL offers disabling, but no clear way to set a VertexArray buffer to `null`
    // But Chrome does not like buffers that are bound to several binding points.
    // So we just bind all the attributes to the dummy "attribute zero" buffer
    this.buffer = this.buffer || new Buffer(this.gl, {size: 4});

    for (const location in this.values) {
      if (this.values[location] instanceof Buffer) {
        this.gl.disableVertexAttribArray(location);
        this.gl.bindBuffer(GL.ARRAY_BUFFER, this.buffer.handle);
        this.gl.vertexAttribPointer(location, 1, GL.FLOAT, false, 0, 0);
      }
    }

    this.setElementBuffer(null);
    return this;
  }
  */
}
