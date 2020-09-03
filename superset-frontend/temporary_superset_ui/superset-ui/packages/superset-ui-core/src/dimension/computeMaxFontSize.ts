import getTextDimension, { GetTextDimensionInput } from './getTextDimension';
import { Dimension } from './types';

function decreaseSizeUntil(
  startSize: number,
  computeDimension: (size: number) => Dimension,
  condition: (dimension: Dimension) => boolean,
): number {
  let size = startSize;
  let dimension = computeDimension(size);
  while (!condition(dimension)) {
    size -= 1;
    dimension = computeDimension(size);
  }

  return size;
}

export default function computeMaxFontSize(
  input: GetTextDimensionInput & {
    maxWidth?: number;
    maxHeight?: number;
    idealFontSize?: number;
  },
) {
  const { idealFontSize, maxWidth, maxHeight, style, ...rest } = input;

  let size: number;
  if (idealFontSize !== undefined && idealFontSize !== null) {
    size = idealFontSize;
  } else if (maxHeight === undefined || maxHeight === null) {
    throw new Error('You must specify at least one of maxHeight or idealFontSize');
  } else {
    size = Math.floor(maxHeight);
  }

  function computeDimension(fontSize: number) {
    return getTextDimension({
      ...rest,
      style: { ...style, fontSize: `${fontSize}px` },
    });
  }

  if (maxWidth !== undefined && maxWidth !== null) {
    size = decreaseSizeUntil(size, computeDimension, dim => dim.width <= maxWidth);
  }

  if (maxHeight !== undefined && maxHeight !== null) {
    size = decreaseSizeUntil(size, computeDimension, dim => dim.height <= maxHeight);
  }

  return size;
}
