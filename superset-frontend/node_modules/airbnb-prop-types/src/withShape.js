import and from './and';
import shape from './shape';

export default function withShape(type, shapeTypes) {
  if (typeof type !== 'function') {
    throw new TypeError('type must be a valid PropType');
  }
  const shapeValidator = shape(shapeTypes);
  return and([type, shapeValidator], 'withShape');
}
