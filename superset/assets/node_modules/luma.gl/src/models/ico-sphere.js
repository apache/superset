import {Model} from '../core';
import {IcoSphereGeometry} from '../geometry';

export default class IcoSphere extends Model {
  constructor(gl, opts = {}) {
    super(gl, Object.assign({}, opts, {geometry: new IcoSphereGeometry(opts)}));
  }
}
