import GL from '@luma.gl/constants';
import {TransformFeedback, Buffer} from '@luma.gl/webgl';
import {getBuffersFromGeometry} from './model-utils';
import BaseModel from './base-model';
import {log, isObjectEmpty, uid, assert} from '../utils';

const ERR_MODEL_PARAMS = 'Model needs drawMode and vertexCount';

export default class Model extends BaseModel {
  constructor(gl, props = {}) {
    // Deduce a helpful id
    const {id = uid('model')} = props;
    super(gl, {...props, id});
  }

  initialize(props) {
    super.initialize(props);

    this.drawMode = props.drawMode !== undefined ? props.drawMode : GL.TRIANGLES;
    this.vertexCount = props.vertexCount || 0;

    // Track buffers created by setGeometry
    this.geometryBuffers = {};

    // geometry might have set drawMode and vertexCount
    this.isInstanced = props.isInstanced || props.instanced;

    this._setModelProps(props);

    // TODO - just to unbreak deck.gl 7.0-beta, remove as soon as updated
    this.geometry = {};

    // assert(program || program instanceof Program);
    assert(this.drawMode !== undefined && Number.isFinite(this.vertexCount), ERR_MODEL_PARAMS);
  }

  setProps(props) {
    super.setProps(props);
    this._setModelProps(props);
  }

  delete() {
    super.delete();

    this._deleteGeometryBuffers();
  }

  // GETTERS

  getDrawMode() {
    return this.drawMode;
  }

  getVertexCount() {
    return this.vertexCount;
  }

  getInstanceCount() {
    return this.instanceCount;
  }

  getAttributes() {
    return this.attributes;
  }

  // SETTERS

  setDrawMode(drawMode) {
    this.drawMode = drawMode;
    return this;
  }

  setVertexCount(vertexCount) {
    assert(Number.isFinite(vertexCount));
    this.vertexCount = vertexCount;
    return this;
  }

  setInstanceCount(instanceCount) {
    assert(Number.isFinite(instanceCount));
    this.instanceCount = instanceCount;
    return this;
  }

  setGeometry(geometry) {
    this.drawMode = geometry.drawMode;
    this.vertexCount = geometry.getVertexCount();

    this._deleteGeometryBuffers();

    this.geometryBuffers = getBuffersFromGeometry(this.gl, geometry);
    this.vertexArray.setAttributes(this.geometryBuffers);
    return this;
  }

  setAttributes(attributes = {}) {
    // Avoid setting needsRedraw if no attributes
    if (isObjectEmpty(attributes)) {
      return this;
    }

    const normalizedAttributes = {};
    for (const name in attributes) {
      const attribute = attributes[name];
      // The `getValue` call provides support for deck.gl `Attribute` class
      // TODO - remove once deck refactoring completes
      normalizedAttributes[name] = attribute.getValue ? attribute.getValue() : attribute;
    }

    this.vertexArray.setAttributes(normalizedAttributes);
    return this;
  }

  // DRAW CALLS

  draw(options = {}) {
    return this.drawGeometry(options);
  }

  // Draw call for transform feedback
  transform(opts = {}) {
    const {discard = true, feedbackBuffers, unbindModels = []} = opts;

    let {parameters} = opts;

    if (feedbackBuffers) {
      this._setFeedbackBuffers(feedbackBuffers);
    }

    if (discard) {
      parameters = Object.assign({}, parameters, {[GL.RASTERIZER_DISCARD]: discard});
    }

    unbindModels.forEach(model => model.vertexArray.unbindBuffers());
    try {
      this.draw(Object.assign({}, opts, {parameters}));
    } finally {
      unbindModels.forEach(model => model.vertexArray.bindBuffers());
    }

    return this;
  }

  // DEPRECATED METHODS

  render(uniforms = {}) {
    log.warn('Model.render() is deprecated. Use Model.setUniforms() and Model.draw()')();
    return this.setUniforms(uniforms).draw();
  }

  // PRIVATE METHODS

  _setModelProps(props) {
    // params
    // if ('drawMode' in props) {
    //   this.drawMode = getDrawMode(props.drawMode);
    // }
    // if ('vertexCount' in props) {
    //   this.vertexCount = props.vertexCount;
    // }
    if ('instanceCount' in props) {
      this.instanceCount = props.instanceCount;
    }
    if ('geometry' in props) {
      this.setGeometry(props.geometry);
    }

    // webgl settings
    if ('attributes' in props) {
      this.setAttributes(props.attributes);
    }
    if ('_feedbackBuffers' in props) {
      this._setFeedbackBuffers(props._feedbackBuffers);
    }
  }

  _deleteGeometryBuffers() {
    for (const name in this.geometryBuffers) {
      // Buffer is raw value (for indices) or first element of [buffer, accessor] pair
      const buffer = this.geometryBuffers[name][0] || this.geometryBuffers[name];
      if (buffer instanceof Buffer) {
        buffer.delete();
      }
    }
  }

  // Updates (evaluates) all function valued uniforms based on a new set of animationProps
  // experimental
  _setAnimationProps(animationProps) {
    if (this.animated) {
      assert(animationProps, 'Model.draw(): animated uniforms but no animationProps');
      const animatedUniforms = this._evaluateAnimateUniforms(animationProps);
      Object.assign(this.uniforms, animatedUniforms);
    }
  }

  // Transform Feedback

  _setFeedbackBuffers(feedbackBuffers = {}) {
    // Avoid setting needsRedraw if no feedbackBuffers
    if (isObjectEmpty(feedbackBuffers)) {
      return this;
    }

    const {gl} = this.program;
    this.transformFeedback =
      this.transformFeedback ||
      new TransformFeedback(gl, {
        program: this.program
      });

    this.transformFeedback.setBuffers(feedbackBuffers);
    return this;
  }
}
