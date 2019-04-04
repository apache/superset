import { Model } from '../core';
import { SphereGeometry } from '../geometry';
import { uid } from '../utils';
export default class Sphere extends Model {
  constructor(gl, opts = {}) {
    const _opts$id = opts.id,
          id = _opts$id === void 0 ? uid('sphere') : _opts$id;
    super(gl, Object.assign({}, opts, {
      id,
      geometry: new SphereGeometry(opts)
    }));
  }

}
//# sourceMappingURL=sphere.js.map