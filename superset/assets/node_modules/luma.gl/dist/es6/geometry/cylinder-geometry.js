import TruncatedConeGeometry from './truncated-cone-geometry';
export default class CylinderGeometry extends TruncatedConeGeometry {
  constructor(opts = {}) {
    const _opts$radius = opts.radius,
          radius = _opts$radius === void 0 ? 1 : _opts$radius;
    super(Object.assign({}, opts, {
      bottomRadius: radius,
      topRadius: radius
    }));
  }

}
//# sourceMappingURL=cylinder-geometry.js.map