import { Margin } from './types';

function mergeOneSide(a: number = 0, b: number = 0, operation: (a: number, b: number) => number) {
  if (Number.isNaN(a) || a === null) return b;
  else if (Number.isNaN(b) || b === null) return a;

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
    bottom: mergeOneSide(bottom, margin2.bottom, operation),
    left: mergeOneSide(left, margin2.left, operation),
    right: mergeOneSide(right, margin2.right, operation),
    top: mergeOneSide(top, margin2.top, operation),
  };
}
