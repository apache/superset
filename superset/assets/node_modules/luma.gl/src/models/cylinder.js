import {CylinderGeometry} from '../geometry';
import Model from '../core/model';

export default class Cylinder extends Model {
  constructor(gl, opts = {}) {
    super(gl, Object.assign({}, opts, {geometry: new CylinderGeometry(opts)}));
  }
}
