import GL from '@luma.gl/constants';
import Resource from './resource';
import Buffer from './buffer';
import {isWebGL2, assertWebGL2Context} from '../webgl-utils';
import {log, isObjectEmpty} from '../utils';

// NOTE: The `bindOnUse` flag is a major workaround:
// See https://github.com/KhronosGroup/WebGL/issues/2346

export default class TransformFeedback extends Resource {
  static isSupported(gl) {
    return isWebGL2(gl);
  }

  constructor(gl, props = {}) {
    assertWebGL2Context(gl);
    super(gl, props);

    this.initialize(props);
    this.stubRemovedMethods('TransformFeedback', 'v6.0', ['pause', 'resume']);
    Object.seal(this);
  }

  initialize(props = {}) {
    this.buffers = {};
    this.unused = {};
    this.configuration = null;
    this.bindOnUse = true;

    // Unbind any currently bound buffers
    if (!isObjectEmpty(this.buffers)) {
      this.bind(() => this._unbindBuffers());
    }

    this.setProps(props);
    return this;
  }

  setProps(props) {
    if ('program' in props) {
      this.configuration = props.program && props.program.configuration;
    }
    if ('configuration' in props) {
      this.configuration = props.configuration;
    }
    if ('bindOnUse' in props) {
      props = props.bindOnUse;
    }
    if ('buffers' in props) {
      this.setBuffers(props.buffers);
    }
  }

  setBuffers(buffers = {}) {
    this.bind(() => {
      for (const bufferName in buffers) {
        this.setBuffer(bufferName, buffers[bufferName]);
      }
    });
    return this;
  }

  setBuffer(locationOrName, bufferOrParams) {
    const location = this._getVaryingIndex(locationOrName);
    const {buffer, byteSize, byteOffset} = this._getBufferParams(bufferOrParams);

    if (location < 0) {
      this.unused[locationOrName] = buffer;
      log.warn(() => `${this.id} unused varying buffer ${locationOrName}`)();
      return this;
    }

    this.buffers[location] = bufferOrParams;

    // Need to avoid chrome bug where buffer that is already bound to a different target
    // cannot be bound to 'TRANSFORM_FEEDBACK_BUFFER' target.
    if (!this.bindOnUse) {
      this._bindBuffer(location, buffer, byteOffset, byteSize);
    }

    return this;
  }

  begin(primitiveMode = GL.POINTS) {
    this.gl.bindTransformFeedback(GL.TRANSFORM_FEEDBACK, this.handle);
    this._bindBuffers();
    this.gl.beginTransformFeedback(primitiveMode);
    return this;
  }

  end() {
    this.gl.endTransformFeedback();
    this._unbindBuffers();
    this.gl.bindTransformFeedback(GL.TRANSFORM_FEEDBACK, null);
    return this;
  }

  // PRIVATE METHODS

  _getBufferParams(bufferOrParams) {
    let byteOffset;
    let byteSize;
    let buffer;
    if (bufferOrParams instanceof Buffer === false) {
      buffer = bufferOrParams.buffer;
      byteSize = bufferOrParams.byteSize;
      byteOffset = bufferOrParams.byteOffset;
    } else {
      buffer = bufferOrParams;
    }
    // to use bindBufferRange, either offset or size must be specified, use default value for the other.
    if (byteOffset !== undefined || byteSize !== undefined) {
      byteOffset = byteOffset || 0;
      byteSize = byteSize || buffer.byteLength - byteOffset;
    }
    return {buffer, byteOffset, byteSize};
  }

  _getVaryingInfo(locationOrName) {
    return this.configuration && this.configuration.getVaryingInfo(locationOrName);
  }

  _getVaryingIndex(locationOrName) {
    if (this.configuration) {
      return this.configuration.getVaryingInfo(locationOrName).location;
    }
    const location = Number(locationOrName);
    return Number.isFinite(location) ? location : -1;
  }

  // Need to avoid chrome bug where buffer that is already bound to a different target
  // cannot be bound to 'TRANSFORM_FEEDBACK_BUFFER' target.
  _bindBuffers() {
    if (this.bindOnUse) {
      for (const bufferIndex in this.buffers) {
        const {buffer, byteSize, byteOffset} = this._getBufferParams(this.buffers[bufferIndex]);
        this._bindBuffer(bufferIndex, buffer, byteOffset, byteSize);
      }
    }
  }

  _unbindBuffers() {
    if (this.bindOnUse) {
      for (const bufferIndex in this.buffers) {
        this._bindBuffer(bufferIndex, null);
      }
    }
  }

  _bindBuffer(index, buffer, byteOffset = 0, byteSize) {
    const handle = buffer && buffer.handle;
    if (!handle || byteSize === undefined) {
      this.gl.bindBufferBase(GL.TRANSFORM_FEEDBACK_BUFFER, index, handle);
    } else {
      this.gl.bindBufferRange(GL.TRANSFORM_FEEDBACK_BUFFER, index, handle, byteOffset, byteSize);
    }
    return this;
  }

  // RESOURCE METHODS

  _createHandle() {
    return this.gl.createTransformFeedback();
  }

  _deleteHandle() {
    this.gl.deleteTransformFeedback(this.handle);
  }

  _bindHandle(handle) {
    this.gl.bindTransformFeedback(GL.TRANSFORM_FEEDBACK, this.handle);
  }
}
