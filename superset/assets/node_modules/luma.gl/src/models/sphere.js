import {Model} from '../core';
import {SphereGeometry} from '../geometry';
import {uid} from '../utils';

export default class Sphere extends Model {
  constructor(gl, opts = {}) {
    const {id = uid('sphere')} = opts;
    super(gl, Object.assign({}, opts, {id, geometry: new SphereGeometry(opts)}));
  }
}
