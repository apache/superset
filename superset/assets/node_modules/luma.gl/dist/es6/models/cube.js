import { CubeGeometry } from '../geometry';
import { Model } from '../core';
import { uid } from '../utils';
export default class Cube extends Model {
  constructor(gl, opts = {}) {
    const _opts$id = opts.id,
          id = _opts$id === void 0 ? uid('cube') : _opts$id;
    super(gl, Object.assign({}, opts, {
      id,
      geometry: new CubeGeometry(opts)
    }));
  }

}
//# sourceMappingURL=cube.js.map