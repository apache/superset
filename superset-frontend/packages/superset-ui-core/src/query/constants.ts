// DODO was here
import {
  ExtraFormDataAppend,
  ExtraFormDataOverrideExtras,
  ExtraFormDataOverrideRegular,
  ExtraFormDataOverride,
  QueryObject,
} from './types';

export const DTTM_ALIAS = '__timestamp';
export const NO_TIME_RANGE = 'No filter';

export const EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS: (keyof ExtraFormDataOverrideExtras)[] =
  ['relative_start', 'relative_end', 'time_grain_sqla'];

export const EXTRA_FORM_DATA_APPEND_KEYS: (keyof ExtraFormDataAppend)[] = [
  'adhoc_filters',
  'filters',
  'interactive_groupby',
  'interactive_highlight',
  'interactive_drilldown',
  'custom_form_data',
];

export const EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS: Record<
  keyof ExtraFormDataOverrideRegular,
  keyof QueryObject
> = {
  granularity: 'granularity',
  granularity_sqla: 'granularity',
  time_column: 'time_column',
  time_grain: 'time_grain',
  time_range: 'time_range',
  time_range_end_type: 'time_range_end_type', // DODO added 44211759
};

export const EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS = Object.keys(
  EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS,
) as (keyof ExtraFormDataOverrideRegular)[];

export const EXTRA_FORM_DATA_OVERRIDE_KEYS: (keyof ExtraFormDataOverride)[] = [
  ...EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS,
  ...EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS,
];
