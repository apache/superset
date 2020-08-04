import TruncatedConeGeometry from './truncated-cone-geometry';
import {uid} from '../utils';

export default class CylinderGeometry extends TruncatedConeGeometry {
  constructor(props = {}) {
    const {id = uid('cylinder-geometry'), radius = 1} = props;
    super({
      ...props,
      id,
      bottomRadius: radius,
      topRadius: radius
    });
  }
}
