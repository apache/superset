import luma from '../init';
import {polyfillContext} from '../webgl-context';
import {assertWebGLContext, isWebGL2, getKey, getKeyValue} from '../webgl-utils';
import {uid} from '../utils';
import assert from '../utils/assert';

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
    this.ext = polyfillContext(gl);
    this.id = id || uid(this.constructor.name);
    this.userData = userData;
    this.opts = opts;

    // Set the handle
    // If handle was provided, use it, otherwise create a new handle

    // TODO - Stores the handle with context loss information
    // this.glCount = glGetContextLossCount(this.gl);

    // Default VertexArray needs to be created with null handle, so compare against undefined
    this._handle = opts.handle;
    if (this._handle === undefined) {
      this._handle = this._createHandle();
    }

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
    this._handle = null;
    this._removeStats();

    // Optionally, recursively delete the children
    if (children && deleteChildren) {
      children.filter(Boolean).forEach(child => {
        child.delete();
      });
    }

    return this;
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

  // PUBLIC VIRTUAL METHODS
  initialize(opts) {
  }

  // PROTECTED METHODS - These must be overridden by subclass
  _createHandle() {
    throw new Error(ERR_RESOURCE_METHOD_UNDEFINED);
  }

  _deleteHandle() {
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

    const {stats} = luma;
    stats.resourceCount = stats.resourceCount || 0;
    stats.resourceMap = stats.resourceMap || {};

    // Resource creation stats
    stats.resourceCount++;
    stats.resourceMap[name] = stats.resourceMap[name] || {created: 0, active: 0};
    stats.resourceMap[name].created++;
    stats.resourceMap[name].active++;
  }

  _removeStats() {
    const name = this.constructor.name;
    const {stats} = luma;

    stats.resourceMap[name].active--;
  }
}
