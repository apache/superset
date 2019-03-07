import { Margin } from './types';

export default function mergeMargin(
  margin1: Partial<Margin> = {},
  margin2: Partial<Margin> = {},
  mode: 'expand' | 'shrink' = 'expand',
) {
  const { top = 0, left = 0, bottom = 0, right = 0 } = margin1;
  const { top: top2 = 0, left: left2 = 0, bottom: bottom2 = 0, right: right2 = 0 } = margin2;

  const func = mode === 'expand' ? Math.max : Math.min;

  return {
    bottom: func(bottom, bottom2),
    left: func(left, left2),
    right: func(right, right2),
    top: func(top, top2),
  };
}
