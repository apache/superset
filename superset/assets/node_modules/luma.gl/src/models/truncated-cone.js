import {TruncatedConeGeometry} from '../geometry';
import {Model} from '../core';

export default class TruncatedCone extends Model {
  constructor(gl, opts = {}) {
    super(gl, Object.assign({}, opts, {geometry: new TruncatedConeGeometry(opts)}));
  }
}
