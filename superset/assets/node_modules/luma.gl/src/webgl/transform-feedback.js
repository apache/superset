import Resource from './resource';
import {isWebGL2, assertWebGL2Context} from '../webgl-utils';
import assert from '../utils/assert';

const GL_TRANSFORM_FEEDBACK_BUFFER = 0x8C8E;
const GL_TRANSFORM_FEEDBACK = 0x8E22;

export default class TranformFeedback extends Resource {

  static isSupported(gl) {
    return isWebGL2(gl);
  }

  static isHandle(handle) {
    return this.gl.isTransformFeedback(this.handle);
  }

  /**
   * @class
   * @param {WebGL2RenderingContext} gl - context
   * @param {Object} opts - options
   */
  constructor(gl, opts = {}) {
    assertWebGL2Context(gl);
    super(gl, opts);
    this.buffers = {};
    Object.seal(this);

    this.initialize(opts);
  }

  initialize({buffers = {}, varyingMap = {}}) {
    this.bindBuffers(buffers, {clear: true, varyingMap});
  }

  bindBuffers(buffers = {}, {clear = false, varyingMap = {}} = {}) {
    if (clear) {
      this._unbindBuffers();
      this.buffers = {};
    }
    for (const bufferName in buffers) {
      const buffer = buffers[bufferName];
      const index = Number.isFinite(Number(bufferName)) ?
        Number(bufferName) : varyingMap[bufferName];
      assert(Number.isFinite(index));
      this.buffers[index] = buffer;
    }
  }

  // TODO: Activation is tightly coupled to the current program. Since we try to encapsulate
  // program.use, should we move these methods (begin/pause/resume/end) to the Program?
  begin(primitiveMode) {
    this._bindBuffers();
    this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, this.handle);
    this.gl.beginTransformFeedback(primitiveMode);
    return this;
  }

  pause() {
    // Rebinding to same handle seem to cause an issue , first found in Chrome version 67.
    // this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, this.handle);
    this.gl.pauseTransformFeedback();
    this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, null);
    this._unbindBuffers();
    return this;
  }

  resume() {
    this._bindBuffers();
    this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, this.handle);
    this.gl.resumeTransformFeedback();
    return this;
  }

  end() {
    // Rebinding to same handle seem to cause an issue , first found in Chrome version 67.
    // this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, this.handle);
    this.gl.endTransformFeedback();
    this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, null);
    this._unbindBuffers();
    return this;
  }

  bindBuffer({index, buffer, offset = 0, size}) {
    // Need to avoid chrome bug where buffer that is already bound to a different target
    // cannot be bound to 'TRANSFORM_FEEDBACK_BUFFER' target.
    buffer.unbind();
    this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, this.handle);
    if (size === undefined) {
      this.gl.bindBufferBase(GL_TRANSFORM_FEEDBACK_BUFFER, index, buffer.handle);
    } else {
      this.gl.bindBufferRange(GL_TRANSFORM_FEEDBACK_BUFFER, index, buffer.handle, offset, size);
    }
    return this;
  }

  unbindBuffer({index}) {
    this.gl.bindTransformFeedback(GL_TRANSFORM_FEEDBACK, this.handle);
    this.gl.bindBufferBase(GL_TRANSFORM_FEEDBACK_BUFFER, index, null);
    return this;
  }

  // PRIVATE METHODS

  // See https://github.com/KhronosGroup/WebGL/issues/2346
  // If it was true that having a buffer on an unused TF was a problem
  // it would make the entire concept of transform feedback objects pointless.
  // The whole point of them is like VertexArrayObjects.
  // You set them up with all in outputs at init time and
  // then in one call you can setup all the outputs just before drawing.
  // Since the point of transform feedback is to generate data that will
  // then be used as inputs to attributes it makes zero sense you'd
  // have to unbind them from every unused transform feedback object
  // before you could use them in an attribute. If that was the case
  // there would be no reason to setup transform feedback objects ever.
  // You'd always use the default because you'd always have to bind and
  // unbind all the buffers.
  _bindBuffers() {
    for (const bufferIndex in this.buffers) {
      this.bindBuffer({buffer: this.buffers[bufferIndex], index: Number(bufferIndex)});
    }
  }

  _unbindBuffers() {
    for (const bufferIndex in this.buffers) {
      this.unbindBuffer({buffer: this.buffers[bufferIndex], index: Number(bufferIndex)});
    }
  }

  // RESOURCE METHODS

  _createHandle() {
    return this.gl.createTransformFeedback();
  }

  _deleteHandle() {
    this.gl.deleteTransformFeedback(this.handle);
  }
}
