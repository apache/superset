import TruncatedConeGeometry from './truncated-cone-geometry';

export default class ConeGeometry extends TruncatedConeGeometry {
  constructor(opts = {}) {
    const {radius = 1, cap = true} = opts;
    super(Object.assign({}, opts, {
      topRadius: 0,
      topCap: Boolean(cap),
      bottomCap: Boolean(cap),
      bottomRadius: radius
    }));
  }
}
