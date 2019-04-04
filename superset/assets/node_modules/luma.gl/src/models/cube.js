import {CubeGeometry} from '../geometry';
import {Model} from '../core';
import {uid} from '../utils';

export default class Cube extends Model {
  constructor(gl, opts = {}) {
    const {id = uid('cube')} = opts;
    super(gl, Object.assign({}, opts, {id, geometry: new CubeGeometry(opts)}));
  }
}
