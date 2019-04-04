import { PlaneGeometry } from '../geometry';
import Model from '../core/model';
import { uid } from '../utils';
export default class Plane extends Model {
  constructor(gl, opts = {}) {
    const _opts$id = opts.id,
          id = _opts$id === void 0 ? uid('plane') : _opts$id;
    super(gl, Object.assign({}, opts, {
      id,
      geometry: new PlaneGeometry(opts)
    }));
  }

}
//# sourceMappingURL=plane.js.map