import { Dimension } from '../types';

const DEFAULT_DIMENSION = { height: 20, width: 100 };

export default function getBBoxCeil(
  node: SVGGraphicsElement,
  defaultDimension: Dimension = DEFAULT_DIMENSION,
) {
  const { width, height } = node.getBBox ? node.getBBox() : defaultDimension;

  return {
    height: Math.ceil(height),
    width: Math.ceil(width),
  };
}
