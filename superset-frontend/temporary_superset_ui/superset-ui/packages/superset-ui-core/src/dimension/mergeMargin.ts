import { Margin } from './types';

function mergeOneSide(operation: (a: number, b: number) => number, a = 0, b = 0) {
  if (Number.isNaN(a) || a === null) return b;
  if (Number.isNaN(b) || b === null) return a;

  return operation(a, b);
}

export default function mergeMargin(
  margin1: Partial<Margin> = {},
  margin2: Partial<Margin> = {},
  mode: 'expand' | 'shrink' = 'expand',
) {
  const { top, left, bottom, right } = margin1;
  const operation = mode === 'expand' ? Math.max : Math.min;

  return {
    bottom: mergeOneSide(operation, bottom, margin2.bottom),
    left: mergeOneSide(operation, left, margin2.left),
    right: mergeOneSide(operation, right, margin2.right),
    top: mergeOneSide(operation, top, margin2.top),
  };
}
