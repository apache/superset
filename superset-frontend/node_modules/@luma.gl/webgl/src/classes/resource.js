import {lumaStats} from '../init';
import {assertWebGLContext, isWebGL2, getKey, getKeyValue} from '../webgl-utils';
import {uid, assert, stubRemovedMethods} from '../utils';

const ERR_RESOURCE_METHOD_UNDEFINED = 'Resource subclass must define virtual methods';

// TODO - Handle context loss
// function glGetContextLossCount(gl) {
//   return (gl.luma && gl.luma.glCount) || 0;
// }

export default class Resource {
  constructor(gl, opts = {}) {
    assertWebGLContext(gl);

    const {id, userData = {}} = opts;
    this.gl = gl;
    // this.ext = polyfillContext(gl);
    this.id = id || uid(this.constructor.name);
    this.userData = userData;
    this._bound = false;

    // Set the handle
    // If handle was provided, use it, otherwise create a new handle

    // TODO - Stores the handle with context loss information
    // this.glCount = glGetContextLossCount(this.gl);

    // Default VertexArray needs to be created with null handle, so compare against undefined
    this._handle = opts.handle;
    if (this._handle === undefined) {
      this._handle = this._createHandle();
    }

    // Only meaningful for resources that allocate GPU memory
    this.byteLength = 0;

    this._addStats();
  }

  toString() {
    return `${this.constructor.name}(${this.id})`;
  }

  get handle() {
    // TODO - Add context loss handling
    // Will regenerate and reinitialize the handle if necessary
    // const glCount = glGetContextLossCount(this.gl);
    // if (this.glCount !== glCount) {
    //   this._handle = this._createHandle(this.opts);
    //   this._glCount = glCount;
    //   // Reinitialize object
    //   this.initialize(this.opts);
    // }
    return this._handle;
  }

  delete({deleteChildren = false} = {}) {
    // Delete this object, and get refs to any children
    const children = this._handle && this._deleteHandle(this._handle);
    if (this._handle) {
      this._removeStats();
    }
    this._handle = null;

    // Optionally, recursively delete the children
    if (children && deleteChildren) {
      children.filter(Boolean).forEach(child => {
        child.delete();
      });
    }

    return this;
  }

  bind(funcOrHandle = this.handle) {
    if (typeof funcOrHandle !== 'function') {
      this._bindHandle(funcOrHandle);
      return this;
    }

    let value;

    if (!this._bound) {
      this._bindHandle(this.handle);
      this._bound = true;

      value = funcOrHandle();

      this._bound = false;
      this._bindHandle(null);
    } else {
      value = funcOrHandle();
    }

    return value;
  }

  unbind() {
    this.bind(null);
  }

  /**
   * Query a Resource parameter
   *
   * @param {GLenum} pname
   * @return {GLint|GLfloat|GLenum} param
   */
  getParameter(pname, opts = {}) {
    pname = getKeyValue(this.gl, pname);
    assert(pname);

    const parameters = this.constructor.PARAMETERS || {};

    // Use parameter definitions to handle unsupported parameters
    const parameter = parameters[pname];
    if (parameter) {
      const isWebgl2 = isWebGL2(this.gl);

      // Check if we can query for this parameter
      const parameterAvailable =
        (!('webgl2' in parameter) || isWebgl2) &&
        (!('extension' in parameter) || this.gl.getExtension(parameter.extension));

      if (!parameterAvailable) {
        const webgl1Default = parameter.webgl1;
        const webgl2Default = 'webgl2' in parameter ? parameter.webgl2 : parameter.webgl1;
        const defaultValue = isWebgl2 ? webgl2Default : webgl1Default;
        return defaultValue;
      }
    }

    // If unknown parameter - Could be a valid parameter not covered by PARAMS
    // Attempt to query for it and let WebGL report errors
    return this._getParameter(pname, opts);
  }

  // Many resources support a getParameter call -
  // getParameters will get all parameters - slow but useful for debugging
  // eslint-disable-next-line complexity
  getParameters(opts = {}) {
    const {parameters, keys} = {};

    // Get parameter definitions for this Resource
    const PARAMETERS = this.constructor.PARAMETERS || {};

    const isWebgl2 = isWebGL2(this.gl);

    const values = {};

    // Query all parameters if no list provided
    const parameterKeys = parameters || Object.keys(PARAMETERS);

    // WEBGL limits
    for (const pname of parameterKeys) {
      const parameter = PARAMETERS[pname];

      // Check if this parameter is available on this platform
      const parameterAvailable =
        parameter &&
        (!('webgl2' in parameter) || isWebgl2) &&
        (!('extension' in parameter) || this.gl.getExtension(parameter.extension));

      if (parameterAvailable) {
        const key = keys ? getKey(this.gl, pname) : pname;
        values[key] = this.getParameter(pname, opts);
        if (keys && parameter.type === 'GLenum') {
          values[key] = getKey(this.gl, values[key]);
        }
      }
    }

    return values;
  }

  /**
   * Update a Resource setting
   *
   * @todo - cache parameter to avoid issuing WebGL calls?
   *
   * @param {GLenum} pname - parameter (GL constant, value or key)
   * @param {GLint|GLfloat|GLenum} value
   * @return {Resource} returns self to enable chaining
   */
  setParameter(pname, value) {
    pname = getKeyValue(this.gl, pname);
    assert(pname);

    const parameters = this.constructor.PARAMETERS || {};

    const parameter = parameters[pname];
    if (parameter) {
      const isWebgl2 = isWebGL2(this.gl);

      // Check if this parameter is available on this platform
      const parameterAvailable =
        (!('webgl2' in parameter) || isWebgl2) &&
        (!('extension' in parameter) || this.gl.getExtension(parameter.extension));

      if (!parameterAvailable) {
        throw new Error('Parameter not available on this platform');
      }

      // Handle string keys
      if (parameter.type === 'GLenum') {
        value = getKeyValue(value);
      }
    }

    // If unknown parameter - Could be a valid parameter not covered by PARAMS
    // attempt to set it and let WebGL report errors
    this._setParameter(pname, value);
    return this;
  }

  /*
   * Batch update resource parameters
   * Assumes the subclass supports a setParameter call
   */
  setParameters(parameters) {
    for (const pname in parameters) {
      this.setParameter(pname, parameters[pname]);
    }
    return this;
  }

  // Install stubs for removed methods
  stubRemovedMethods(className, version, methodNames) {
    return stubRemovedMethods(this, className, version, methodNames);
  }

  // PUBLIC VIRTUAL METHODS
  initialize(opts) {}

  // PROTECTED METHODS - These must be overridden by subclass
  _createHandle() {
    throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
  }

  _deleteHandle() {
    throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
  }

  _bindHandle() {
    throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
  }

  _getOptsFromHandle() {
    throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
  }

  _getParameter(pname, opts) {
    throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
  }

  /**
   * @param {GLenum} pname
   * @param {GLint|GLfloat|GLenum} param
   * @return {Sampler} returns self to enable chaining
   */
  _setParameter(pname, value) {
    throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
  }

  // PRIVATE METHODS

  _context() {
    this.gl.luma = this.gl.luma || {};
    return this.gl.luma;
  }

  _addStats() {
    const name = this.constructor.name;
    const stats = lumaStats.get('Resource Counts');

    stats.get('Resources Created').incrementCount();
    stats.get(`${name}s Created`).incrementCount();
    stats.get(`${name}s Active`).incrementCount();
  }

  _removeStats() {
    const name = this.constructor.name;
    const stats = lumaStats.get('Resource Counts');

    stats.get(`${name}s Active`).decrementCount();
  }

  _trackAllocatedMemory(bytes, name = this.constructor.name) {
    const stats = lumaStats.get('Memory Usage');

    stats.get('GPU Memory').addCount(bytes);
    stats.get(`${name} Memory`).addCount(bytes);
    this.byteLength = bytes;
  }

  _trackDeallocatedMemory(name = this.constructor.name) {
    const stats = lumaStats.get('Memory Usage');

    stats.get('GPU Memory').subtractCount(this.byteLength);
    stats.get(`${name} Memory`).subtractCount(this.byteLength);
    this.byteLength = 0;
  }
}
