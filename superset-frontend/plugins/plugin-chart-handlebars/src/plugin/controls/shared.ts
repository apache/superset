import {
  ControlPanelsContainerProps,
  ControlStateMapping,
} from '@superset-ui/chart-controls';
import {
  ensureIsArray,
  QueryFormColumn,
  QueryMode,
  t,
} from '@superset-ui/core';

export function getQueryMode(controls: ControlStateMapping): QueryMode {
  const mode = controls?.query_mode?.value;
  if (mode === QueryMode.aggregate || mode === QueryMode.raw) {
    return mode as QueryMode;
  }
  const rawColumns = controls?.all_columns?.value as
    | QueryFormColumn[]
    | undefined;
  const hasRawColumns = rawColumns && rawColumns.length > 0;
  return hasRawColumns ? QueryMode.raw : QueryMode.aggregate;
}

/**
 * Visibility check
 */
export function isQueryMode(mode: QueryMode) {
  return ({ controls }: Pick<ControlPanelsContainerProps, 'controls'>) =>
    getQueryMode(controls) === mode;
}

export const isAggMode = isQueryMode(QueryMode.aggregate);
export const isRawMode = isQueryMode(QueryMode.raw);

export const validateAggControlValues = (
  controls: ControlStateMapping,
  values: any[],
) => {
  const areControlsEmpty = values.every(val => ensureIsArray(val).length === 0);
  return areControlsEmpty && isAggMode({ controls })
    ? [t('Group By, Metrics or Percentage Metrics must have a value')]
    : [];
};
