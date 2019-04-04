/* eslint-disable no-inline-comments */
import GL from '../constants';
import {isWebGL2, assertWebGL2Context} from '../webgl-utils';
import Resource from './resource';

export default class Sampler extends Resource {

  static isSupported(gl) {
    return isWebGL2(gl);
  }

  static isHandle(handle) {
    return this.gl.isSampler(this.handle);
  }

  constructor(gl, opts) {
    assertWebGL2Context(gl);
    super(gl, opts);
    Object.seal(this);
  }

  /**
   * Bind to the same texture unit as a texture to control sampling for that texture
   * @param {GLuint} unit - texture unit index
   * @return {Sampler} - returns self to enable chaining
   */
  bind(unit) {
    this.gl.bindSampler(unit, this.handle);
    return this;
  }

  /**
   * Bind to the same texture unit as a texture to control sampling for that texture
   * @param {GLuint} unit - texture unit index
   * @return {Sampler} - returns self to enable chaining
   */
  unbind(unit) {
    this.gl.bindSampler(unit, null);
    return this;
  }

  // RESOURCE METHODS

  _createHandle() {
    return this.gl.createSampler();
  }

  _deleteHandle() {
    this.gl.deleteSampler(this.handle);
  }

  _getParameter(pname) {
    const value = this.gl.getSamplerParameter(this.handle, pname);
    return value;
  }

  _setParameter(pname, param) {
    // Apparently there are some conversion integer/float rules that made
    // the WebGL committe expose two parameter setting functions in JavaScript.
    // For now, pick the float version for parameters specified as GLfloat.
    switch (pname) {
    case GL.TEXTURE_MIN_LOD:
    case GL.TEXTURE_MAX_LOD:
      this.gl.samplerParameterf(this.handle, pname, param);
      break;
    default:
      this.gl.samplerParameteri(this.handle, pname, param);
      break;
    }
    return this;
  }

}
