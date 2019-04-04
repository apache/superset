import {uid} from '../utils';
import {Vector3, Matrix4} from 'math.gl';
import assert from '../utils/assert';

export default class Object3D {

  constructor({id, display = true}) {
    // model position, rotation, scale and all in all matrix
    this.position = new Vector3();
    this.rotation = new Vector3();
    this.scale = new Vector3(1, 1, 1);
    this.matrix = new Matrix4();

    // whether to display the object at all
    this.id = id || uid(this.constructor.name);
    this.display = true;
    this.userData = {};
  }

  setPosition(position) {
    assert(position.length === 3, 'setPosition requires vector argument');
    this.position = position;
    return this;
  }

  setRotation(rotation) {
    assert(rotation.length === 3, 'setRotation requires vector argument');
    this.rotation = rotation;
    return this;
  }

  setScale(scale) {
    assert(scale.length === 3, 'setScale requires vector argument');
    this.scale = scale;
    return this;
  }

  setMatrixComponents({position, rotation, scale, update = true}) {
    if (position) {
      this.setPosition(position);
    }
    if (rotation) {
      this.setRotation(rotation);
    }
    if (scale) {
      this.setScale(scale);
    }
    if (update) {
      this.updateMatrix();
    }
    return this;
  }

  updateMatrix() {
    const pos = this.position;
    const rot = this.rotation;
    const scale = this.scale;

    this.matrix.identity();
    this.matrix.translate(pos);
    this.matrix.rotateXYZ(rot);
    this.matrix.scale(scale);
    return this;
  }

  update({position, rotation, scale} = {}) {
    if (position) {
      this.setPosition(position);
    }
    if (rotation) {
      this.setRotation(rotation);
    }
    if (scale) {
      this.setScale(scale);
    }
    this.updateMatrix();
    return this;
  }

  getCoordinateUniforms(viewMatrix, modelMatrix) {
    // TODO - solve multiple class problem
    // assert(viewMatrix instanceof Matrix4);
    assert(viewMatrix);
    modelMatrix = modelMatrix || this.matrix;
    const worldMatrix = new Matrix4(viewMatrix).multiplyRight(modelMatrix);
    const worldInverse = worldMatrix.invert();
    const worldInverseTranspose = worldInverse.transpose();

    return {
      viewMatrix,
      modelMatrix,
      objectMatrix: modelMatrix,
      worldMatrix,
      worldInverseMatrix: worldInverse,
      worldInverseTransposeMatrix: worldInverseTranspose
    };
  }

  // TODO - copied code, not yet vetted
  transform() {

    if (!this.parent) {
      this.endPosition.set(this.position);
      this.endRotation.set(this.rotation);
      this.endScale.set(this.scale);
    } else {
      const parent = this.parent;
      this.endPosition.set(this.position.add(parent.endPosition));
      this.endRotation.set(this.rotation.add(parent.endRotation));
      this.endScale.set(this.scale.add(parent.endScale));
    }

    const ch = this.children;
    for (let i = 0; i < ch.length; ++i) {
      ch[i].transform();
    }

    return this;
  }
}
