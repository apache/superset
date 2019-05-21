import { createSelector } from 'reselect';
import { Margin } from '@superset-ui/dimension';

export const DEFAULT_MARGIN = { bottom: 20, left: 20, right: 20, top: 20 };

export default function createMarginSelector(defaultMargin: Margin = DEFAULT_MARGIN) {
  return createSelector(
    (margin: Partial<Margin>) => margin.bottom,
    margin => margin.left,
    margin => margin.right,
    margin => margin.top,
    (
      bottom = defaultMargin.bottom,
      left = defaultMargin.left,
      right = defaultMargin.right,
      top = defaultMargin.top,
    ) => ({
      bottom,
      left,
      right,
      top,
    }),
  );
}
