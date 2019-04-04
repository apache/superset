import {ConeGeometry} from '../geometry';
import {Model} from '../core';

export default class Cone extends Model {
  constructor(gl, opts = {}) {
    super(gl, Object.assign({}, opts, {geometry: new ConeGeometry(opts)}));
  }
}
