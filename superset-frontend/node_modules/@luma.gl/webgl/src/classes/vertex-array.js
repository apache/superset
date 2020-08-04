import GL from '@luma.gl/constants';
import Accessor from './accessor';
import Buffer from './buffer';
import VertexArrayObject from './vertex-array-object';
import {log, assert, stubRemovedMethods} from '../utils';

const ERR_ATTRIBUTE_TYPE =
  'VertexArray: attributes must be Buffers or constants (i.e. typed array)';

// This is done to support mat type attributes.
// See section "Notes about setting mat type attributes"
// in vertex-array.md
const MULTI_LOCATION_ATTRIBUTE_REGEXP = /^(.+)__LOCATION_([0-9]+)$/;

const DEPRECATIONS_V6 = [
  'setBuffers',
  'setGeneric',
  'clearBindings',
  'setLocations',
  'setGenericValues',
  'setDivisor',
  'enable',
  'disable'
];

export default class VertexArray {
  constructor(gl, opts = {}) {
    // Use program's id if program is supplied but no id is supplied
    const id = opts.id || (opts.program && opts.program.id);
    // super(gl, Object.assign({}, opts, {id}));

    this.id = id;
    this.gl = gl;
    this.configuration = null;

    // Extracted information
    this.elements = null;
    this.elementsAccessor = null;
    this.values = null;
    this.accessors = null;
    this.unused = null;
    this.drawParams = null;
    this.buffer = null; // For attribute 0 on desktops, and created when unbinding buffers

    this.attributes = {};

    this.vertexArrayObject = VertexArrayObject.isSupported(gl)
      ? new VertexArrayObject(gl)
      : VertexArrayObject.getDefaultArray(gl);

    // Issue errors when using removed methods
    stubRemovedMethods(this, 'VertexArray', 'v6.0', DEPRECATIONS_V6);

    this.initialize(opts);
    Object.seal(this);
  }

  delete() {
    if (this.buffer) {
      this.buffer.delete();
    }
  }

  initialize(props = {}) {
    this.reset();
    this.configuration = null;
    this.bindOnUse = false;
    return this.setProps(props);
  }

  // Resets all attributes (to default valued constants)
  reset() {
    // this.vertexArrayObject.reset();

    this.elements = null;
    this.elementsAccessor = null;
    const {MAX_ATTRIBUTES} = this.vertexArrayObject;
    this.values = new Array(MAX_ATTRIBUTES).fill(null);
    this.accessors = new Array(MAX_ATTRIBUTES).fill(null);
    this.unused = {};

    // Auto detects draw params
    this.drawParams = null;

    return this;
  }

  setProps(props) {
    if ('program' in props) {
      this.configuration = props.program && props.program.configuration;
    }
    if ('configuration' in props) {
      this.configuration = props.configuration;
    }
    if ('attributes' in props) {
      this.setAttributes(props.attributes);
    }
    if ('elements' in props) {
      this.setElementBuffer(props.elements);
    }
    if ('bindOnUse' in props) {
      props = props.bindOnUse;
    }
    return this;
  }

  // Automatically called if buffers changed through VertexArray API
  clearDrawParams() {
    this.drawParams = null;
  }

  getDrawParams(appParameters) {
    // Auto deduced draw parameters
    this.drawParams = this.drawParams || this._updateDrawParams();

    // Override with any application supplied draw parameters
    return Object.assign({}, this.drawParams, appParameters);
  }

  // Set (bind) an array or map of vertex array buffers, either in numbered or named locations.
  // For names that are not present in `location`, the supplied buffers will be ignored.
  // if a single buffer of type GL.ELEMENT_ARRAY_BUFFER is present, it will be set as elements
  //   Signatures:
  //     {attributeName: buffer}
  //     {attributeName: [buffer, accessor]}
  //     {attributeName: (typed) array} => constant
  setAttributes(attributes) {
    Object.assign(this.attributes, attributes);
    this.vertexArrayObject.bind(() => {
      for (const locationOrName in attributes) {
        const value = attributes[locationOrName];
        this._setAttribute(locationOrName, value);
      }
      // Make sure we don't leave any bindings
      this.gl.bindBuffer(GL.ARRAY_BUFFER, null);
    });

    return this;
  }

  // Set (bind) an elements buffer, for indexed rendering.
  // Must be a Buffer bound to GL.ELEMENT_ARRAY_BUFFER. Constants not supported
  setElementBuffer(elementBuffer = null, accessor = {}) {
    this.elements = elementBuffer; // Save value for debugging
    this.elementsAccessor = accessor;
    this.clearDrawParams();

    // Update vertexArray immediately if we have our own array
    if (!this.vertexArrayObject.isDefaultArray) {
      this.vertexArrayObject.setElementBuffer(elementBuffer, accessor);
    }
    return this;
  }

  // Set a location in vertex attributes array to a buffer
  setBuffer(locationOrName, buffer, appAccessor = {}) {
    // Check target
    if (buffer.target === GL.ELEMENT_ARRAY_BUFFER) {
      return this.setElementBuffer(buffer, appAccessor);
    }

    const {location, accessor} = this._resolveLocationAndAccessor(
      locationOrName,
      buffer,
      buffer.accessor,
      appAccessor
    );

    if (location >= 0) {
      this.values[location] = buffer;
      this.accessors[location] = accessor;
      this.clearDrawParams();

      // Update vertexArray immediately if we have our own array
      if (!this.vertexArrayObject.isDefaultArray) {
        this.vertexArrayObject.setBuffer(location, buffer, accessor);
      }
    }

    return this;
  }

  // Set attribute to constant value (small typed array corresponding to one vertex' worth of data)
  setConstant(locationOrName, arrayValue, appAccessor = {}) {
    const {location, accessor} = this._resolveLocationAndAccessor(
      locationOrName,
      arrayValue,
      // Ensure that size isn't taken from program for multi-column
      // attributes
      Object.assign({size: arrayValue.length}, appAccessor)
    );

    if (location >= 0) {
      arrayValue = this.vertexArrayObject._normalizeConstantArrayValue(arrayValue, accessor);

      this.values[location] = arrayValue;
      this.accessors[location] = accessor;
      this.clearDrawParams();

      // Update vertexArray immediately if we have our own array
      // NOTE: We set the actual constant value later on bind. We can't set the value now since
      // constants are global and affect all other VertexArrays that have disabled attributes
      // in the same location.
      // We do disable the attribute which makes it use the global constant value at that location
      if (!this.vertexArrayObject.isDefaultArray) {
        this.vertexArrayObject.enable(location, false);
      }
    }

    return this;
  }

  // Workaround for Chrome TransformFeedback binding issue
  // If required, unbind temporarily to avoid conflicting with TransformFeedback
  unbindBuffers() {
    this.vertexArrayObject.bind(() => {
      if (this.elements) {
        // Update vertexArray immediately if we have our own array
        if (!this.vertexArrayObject.isDefaultArray) {
          this.vertexArrayObject.setElementBuffer(null);
        }
      }

      // Chrome does not like buffers that are bound to several binding points,
      // so we need to offer and unbind facility
      // WebGL offers disabling, but no clear way to set a VertexArray buffer to `null`
      // So we just bind all the attributes to the dummy "attribute zero" buffer
      this.buffer = this.buffer || new Buffer(this.gl, {accessor: {size: 4}});

      for (let location = 0; location < this.vertexArrayObject.MAX_ATTRIBUTES; location++) {
        if (this.values[location] instanceof Buffer) {
          this.gl.disableVertexAttribArray(location);
          this.gl.bindBuffer(GL.ARRAY_BUFFER, this.buffer.handle);
          this.gl.vertexAttribPointer(location, 1, GL.FLOAT, false, 0, 0);
        }
      }
    });
    return this;
  }

  // Workaround for Chrome TransformFeedback binding issue
  // If required, rebind rebind after temporary unbind
  bindBuffers() {
    this.vertexArrayObject.bind(() => {
      if (this.elements) {
        this.setElementBuffer(this.elements);
      }

      for (let location = 0; location < this.vertexArrayObject.MAX_ATTRIBUTES; location++) {
        const buffer = this.values[location];
        if (buffer instanceof Buffer) {
          this.setBuffer(location, buffer);
        }
      }
    });
    return this;
  }

  // Bind for use
  // When a vertex array is about to be used, we must:
  // - Set constant attributes (since these are stored on the context and reset on bind)
  // - Check if we need to initialize the buffer
  bindForDraw(vertexCount, instanceCount, func) {
    let value;

    this.vertexArrayObject.bind(() => {
      // Make sure that any constant attributes are updated (stored on the context, not the VAO)
      // Also handles attribute 0
      this._setConstantAttributes(vertexCount, instanceCount);

      if (!this.vertexArrayObject.hasVertexArrays) {
        this.bindBuffers();
      }

      value = func();

      if (!this.vertexArrayObject.hasVertexArrays) {
        this.unbindBuffers();
      }
    });

    return value;
  }

  // PRIVATE

  // Resolve locations and accessors
  _resolveLocationAndAccessor(locationOrName, value, valueAccessor, appAccessor) {
    const {location, name} = this._getAttributeIndex(locationOrName);
    if (!Number.isFinite(location) || location < 0) {
      this.unused[locationOrName] = value;
      log.once(3, () => `unused value ${locationOrName} in ${this.id}`)();
      return this;
    }

    const accessInfo = this._getAttributeInfo(name || location);

    // Attribute location wasn't directly found.
    // Likely due to multi-location attributes (e.g. matrix)
    if (!accessInfo) {
      return {
        location: -1,
        accessor: null
      };
    }

    // Resolve the partial accessors into a final accessor
    const accessor = Accessor.resolve(accessInfo.accessor, valueAccessor, appAccessor);

    const {size, type} = accessor;
    assert(Number.isFinite(size) && Number.isFinite(type));

    return {location, accessor};
  }

  _getAttributeInfo(attributeName) {
    return this.configuration && this.configuration.getAttributeInfo(attributeName);
  }

  _getAttributeIndex(locationOrName) {
    const location = Number(locationOrName);
    if (Number.isFinite(location)) {
      return {location};
    }

    const multiLocation = MULTI_LOCATION_ATTRIBUTE_REGEXP.exec(locationOrName);
    const name = multiLocation ? multiLocation[1] : locationOrName;
    const locationOffset = multiLocation ? Number(multiLocation[2]) : 0;

    if (this.configuration) {
      return {
        location: this.configuration.getAttributeLocation(name) + locationOffset,
        name
      };
    }

    return {location: -1};
  }

  _setAttribute(locationOrName, value) {
    if (value instanceof Buffer) {
      //  Signature: {attributeName: Buffer}
      this.setBuffer(locationOrName, value);
    } else if (Array.isArray(value) && value.length && value[0] instanceof Buffer) {
      // Signature: {attributeName: [buffer, accessor]}
      const buffer = value[0];
      const accessor = value[1];
      this.setBuffer(locationOrName, buffer, accessor);
    } else if (ArrayBuffer.isView(value) || Array.isArray(value)) {
      // Signature: {attributeName: constant}, constant == short (typed) array
      const constant = value;
      this.setConstant(locationOrName, constant);
    } else if (value.buffer instanceof Buffer) {
      // luma.gl v7: Support accessor objects with 'buffer' field
      // for interleaved data
      // Signature: {attributeName: {...accessor, buffer}}
      const accessor = value;
      this.setBuffer(locationOrName, accessor.buffer, accessor);
    } else {
      throw new Error(ERR_ATTRIBUTE_TYPE);
    }
  }

  // Updates all constant attribute values (constants are used when vertex attributes are disabled).
  // This needs to be done repeatedly since in contrast to buffer bindings,
  // constants are stored on the WebGL context, not the VAO
  _setConstantAttributes(vertexCount, instanceCount) {
    // TODO - use accessor to determine what length to use
    const elementCount = Math.max(vertexCount | 0, instanceCount | 0);
    let constant = this.values[0];
    if (ArrayBuffer.isView(constant)) {
      this._setConstantAttributeZero(constant, elementCount);
    }

    for (let location = 1; location < this.vertexArrayObject.MAX_ATTRIBUTES; location++) {
      constant = this.values[location];
      if (ArrayBuffer.isView(constant)) {
        this._setConstantAttribute(location, constant);
      }
    }
  }

  _setConstantAttributeZero(constant, elementCount) {
    if (VertexArrayObject.isSupported(this.gl, {constantAttributeZero: true})) {
      this._setConstantAttribute(0, constant);
      return;
    }

    // Get a dummy buffer populated with repeated constants
    const buffer = this.vertexArrayObject.getConstantBuffer(elementCount, constant);

    // Set the buffer on location 0
    this.vertexArrayObject.setBuffer(0, buffer, this.accessors[0]);
  }

  _setConstantAttribute(location, constant) {
    VertexArrayObject.setConstant(this.gl, location, constant);

    // If we are using the global VertexArrayObject, we need to disable the attribute now
    if (this.vertexArrayObject.isDefaultArray) {
      this.vertexArrayObject.enable(location, false);
    }
  }

  // Walks the buffers and updates draw parameters
  _updateDrawParams() {
    const drawParams = {
      isIndexed: false,
      isInstanced: false,
      indexCount: Infinity,
      vertexCount: Infinity,
      instanceCount: Infinity
    };

    for (let location = 0; location < this.vertexArrayObject.MAX_ATTRIBUTES; location++) {
      this._updateDrawParamsForLocation(drawParams, location);
    }

    if (this.elements) {
      // indexing is autodetected - buffer with target GL.ELEMENT_ARRAY_BUFFER
      // index type is saved for drawElement calls
      drawParams.elementCount = this.elements.getElementCount(this.elements.accessor);
      drawParams.isIndexed = true;
      drawParams.indexType = this.elementsAccessor.type || this.elements.accessor.type;
      drawParams.indexOffset = this.elementsAccessor.offset || 0;
    }

    // Post-calculation checks
    if (drawParams.indexCount === Infinity) {
      drawParams.indexCount = 0;
    }
    if (drawParams.vertexCount === Infinity) {
      drawParams.vertexCount = 0;
    }
    if (drawParams.instanceCount === Infinity) {
      drawParams.instanceCount = 0;
    }

    return drawParams;
  }

  _updateDrawParamsForLocation(drawParams, location) {
    const value = this.values[location];
    const accessor = this.accessors[location];

    if (!value) {
      return;
    }

    // Check if instanced (whether buffer or constant)
    const {divisor} = accessor;
    const isInstanced = divisor > 0;
    drawParams.isInstanced = drawParams.isInstanced || isInstanced;

    if (value instanceof Buffer) {
      const buffer = value;

      if (isInstanced) {
        // instance attribute
        const instanceCount = buffer.getVertexCount(accessor);
        drawParams.instanceCount = Math.min(drawParams.instanceCount, instanceCount);
      } else {
        // normal attribute
        const vertexCount = buffer.getVertexCount(accessor);
        drawParams.vertexCount = Math.min(drawParams.vertexCount, vertexCount);
      }
    }
  }

  // DEPRECATED in v6.x - but not warnings not properly implemented

  setElements(elementBuffer = null, accessor = {}) {
    log.deprecated('setElements', 'setElementBuffer')();
    return this.setElementBuffer(elementBuffer, accessor);
  }
}
