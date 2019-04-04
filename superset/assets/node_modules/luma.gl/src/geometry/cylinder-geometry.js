import TruncatedConeGeometry from './truncated-cone-geometry';

export default class CylinderGeometry extends TruncatedConeGeometry {
  constructor(opts = {}) {
    const {radius = 1} = opts;
    super(Object.assign({}, opts, {
      bottomRadius: radius,
      topRadius: radius
    }));
  }
}
