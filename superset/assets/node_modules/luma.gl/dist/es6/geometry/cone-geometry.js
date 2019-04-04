import TruncatedConeGeometry from './truncated-cone-geometry';
export default class ConeGeometry extends TruncatedConeGeometry {
  constructor(opts = {}) {
    const _opts$radius = opts.radius,
          radius = _opts$radius === void 0 ? 1 : _opts$radius,
          _opts$cap = opts.cap,
          cap = _opts$cap === void 0 ? true : _opts$cap;
    super(Object.assign({}, opts, {
      topRadius: 0,
      topCap: Boolean(cap),
      bottomCap: Boolean(cap),
      bottomRadius: radius
    }));
  }

}
//# sourceMappingURL=cone-geometry.js.map