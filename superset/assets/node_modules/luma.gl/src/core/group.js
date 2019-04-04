import Object3D from './object-3d';
import {Matrix4} from 'math.gl';
import assert from '../utils/assert';

export default class Group extends Object3D {
  constructor(opts = {}) {
    const {children = []} = opts;
    children.every(child => assert(child instanceof Object3D));
    super(opts);
    this.children = children;
  }

  // Unpacks arrays and nested arrays of children
  add(...children) {
    for (const child of children) {
      if (Array.isArray(child)) {
        this.add(...child);
      } else {
        this.children.push(child);
      }
    }
    return this;
  }

  remove(child) {
    const children = this.children;
    const indexOf = children.indexOf(child);
    if (indexOf > -1) {
      children.splice(indexOf, 1);
    }
    return this;
  }

  removeAll() {
    this.children = [];
    return this;
  }

  // If visitor returns a truthy value, traversal will be aborted and that value
  // will be returned from `traverse`. Otherwise `traverse` will return null.
  traverse(visitor, {modelMatrix = new Matrix4()} = {}) {
    for (const child of this.children) {
      const {matrix} = child;
      modelMatrix = modelMatrix.multiplyRight(matrix);
      let result;
      if (child instanceof Group) {
        result = child.traverse(visitor, {modelMatrix});
      } else {
        // child.setUniforms({modelMatrix});
        result = visitor(child, {});
      }
      // Abort if a result was returned
      if (result) {
        return result;
      }
    }
    return null;
  }

  // If visitor returns a truthy value, traversal will be aborted and that value
  // will be returned from `traverseReverse`. Otherwise `traverseReverse` will return null.
  traverseReverse(visitor, {modelMatrix = new Matrix4()} = {}) {
    for (let i = this.children.length - 1; i >= 0; --i) {
      const child = this.children[i];
      const {matrix} = child;
      modelMatrix = modelMatrix.multiplyRight(matrix);
      let result;
      if (child instanceof Group) {
        result = child.traverseReverse(visitor, {modelMatrix});
      } else {
        // child.setUniforms({modelMatrix});
        result = visitor(child, {});
      }
      // Abort if a result was returned
      if (result) {
        return result;
      }
    }
    return null;
  }
}
