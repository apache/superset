import {isWebGL2, Buffer, TransformFeedback} from '@luma.gl/webgl';
import {assert} from '../../utils';

export default class BufferTransform {
  constructor(gl, props = {}) {
    this.gl = gl;
    this.currentIndex = 0;
    this.feedbackMap = {};
    this.varyings = null; // varyings array
    this.bindings = []; // each element is an object : {sourceBuffers, feedbackBuffers, transformFeedback}

    this.resources = {}; // resources to be deleted

    this._initialize(props);
    Object.seal(this);
  }

  setupResources(opts) {
    for (const binding of this.bindings) {
      this._setupTransformFeedback(binding, opts);
    }
  }

  updateModelProps(props = {}) {
    const {varyings} = this;
    if (varyings.length > 0) {
      props = Object.assign({}, props, {varyings});
    }
    return props;
  }

  getDrawOptions(opts = {}) {
    const binding = this.bindings[this.currentIndex];
    const {sourceBuffers, transformFeedback} = binding;
    const attributes = Object.assign({}, sourceBuffers, opts.attributes);

    return {attributes, transformFeedback};
  }

  swap() {
    if (this.feedbackMap) {
      this.currentIndex = this._getNextIndex();
      return true;
    }
    return false;
  }

  // update source and/or feedbackBuffers
  update(opts = {}) {
    this._setupBuffers(opts);
  }

  // returns current feedbackBuffer of given name
  getBuffer(varyingName) {
    const {feedbackBuffers} = this.bindings[this.currentIndex];
    const bufferOrParams = varyingName ? feedbackBuffers[varyingName] : null;
    if (!bufferOrParams) {
      return null;
    }
    return bufferOrParams instanceof Buffer ? bufferOrParams : bufferOrParams.buffer;
  }

  getData({varyingName} = {}) {
    const buffer = this.getBuffer(varyingName);
    if (buffer) {
      return buffer.getData();
    }
    return null;
  }

  // Delete owned resources.
  delete() {
    for (const name in this.resources) {
      this.resources[name].delete();
    }
  }

  // Private

  _initialize(props = {}) {
    this._setupBuffers(props);
    this.varyings = props.varyings || Object.keys(this.bindings[this.currentIndex].feedbackBuffers);
    if (this.varyings.length > 0) {
      // if writting to buffers make sure it is WebGL2
      assert(isWebGL2(this.gl));
    }
  }

  // auto create feedback buffers if requested
  _getFeedbackBuffers(props) {
    const {sourceBuffers = {}} = props;
    const feedbackBuffers = {};
    if (this.bindings[this.currentIndex]) {
      // this gurantees a partial feedback buffer set doesn't update
      // previously set buffers during auto creation mode.
      Object.assign(feedbackBuffers, this.bindings[this.currentIndex].feedbackBuffers);
    }
    if (this.feedbackMap) {
      // feedbackMap is defined as sourceBuffer as key and feedbackBuffer name as object
      for (const sourceName in this.feedbackMap) {
        const feedbackName = this.feedbackMap[sourceName];
        if (sourceName in sourceBuffers) {
          feedbackBuffers[feedbackName] = sourceName;
        }
      }
    }
    Object.assign(feedbackBuffers, props.feedbackBuffers);
    for (const bufferName in feedbackBuffers) {
      const bufferOrRef = feedbackBuffers[bufferName];
      if (typeof bufferOrRef === 'string') {
        // Create new buffer with same layout and settings as source buffer
        const sourceBuffer = sourceBuffers[bufferOrRef];
        const {byteLength, usage, accessor} = sourceBuffer;
        feedbackBuffers[bufferName] = this._createNewBuffer(bufferName, {
          byteLength,
          usage,
          accessor
        });
      }
    }

    return feedbackBuffers;
  }

  _setupBuffers(props = {}) {
    const {sourceBuffers = null} = props;
    Object.assign(this.feedbackMap, props.feedbackMap);
    const feedbackBuffers = this._getFeedbackBuffers(props);
    this._updateBindings({sourceBuffers, feedbackBuffers});
  }

  _setupTransformFeedback(binding, {model}) {
    const {program} = model;
    binding.transformFeedback = new TransformFeedback(this.gl, {
      program,
      buffers: binding.feedbackBuffers
    });
  }

  _updateBindings(opts) {
    this.bindings[this.currentIndex] = this._updateBinding(this.bindings[this.currentIndex], opts);
    if (this.feedbackMap) {
      const {sourceBuffers, feedbackBuffers} = this._swapBuffers(this.bindings[this.currentIndex]);
      const nextIndex = this._getNextIndex();
      this.bindings[nextIndex] = this._updateBinding(this.bindings[nextIndex], {
        sourceBuffers,
        feedbackBuffers
      });
    }
  }

  _updateBinding(binding, opts) {
    if (!binding) {
      return {
        sourceBuffers: Object.assign({}, opts.sourceBuffers),
        feedbackBuffers: Object.assign({}, opts.feedbackBuffers)
      };
    }
    Object.assign(binding.sourceBuffers, opts.sourceBuffers);
    Object.assign(binding.feedbackBuffers, opts.feedbackBuffers);
    if (binding.transformFeedback) {
      binding.transformFeedback.setBuffers(binding.feedbackBuffers);
    }
    return binding;
  }

  _swapBuffers(opts) {
    if (!this.feedbackMap) {
      return null;
    }
    const sourceBuffers = Object.assign({}, opts.sourceBuffers);
    const feedbackBuffers = Object.assign({}, opts.feedbackBuffers);
    for (const srcName in this.feedbackMap) {
      const dstName = this.feedbackMap[srcName];
      sourceBuffers[srcName] = opts.feedbackBuffers[dstName];
      feedbackBuffers[dstName] = opts.sourceBuffers[srcName];

      // make sure the new destination buffer is a Buffer object
      assert(feedbackBuffers[dstName] instanceof Buffer);
    }
    return {sourceBuffers, feedbackBuffers};
  }

  // Create a buffer and add to list of buffers to be deleted.
  _createNewBuffer(name, opts) {
    const buffer = new Buffer(this.gl, opts);
    if (this.resources[name]) {
      this.resources[name].delete();
    }
    this.resources[name] = buffer;
    return buffer;
  }

  _getNextIndex() {
    return (this.currentIndex + 1) % 2;
  }
}
