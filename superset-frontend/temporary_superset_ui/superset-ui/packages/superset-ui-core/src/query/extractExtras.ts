/* eslint-disable camelcase */
import {
  AppliedTimeExtras,
  isDruidFormData,
  QueryFormData,
  QueryObjectExtras,
  QueryObjectFilterClause,
  TimeColumnConfigKey,
} from './types';

type ExtraFilterQueryField = {
  time_range?: string;
  granularity_sqla?: string;
  time_grain_sqla?: string;
  druid_time_origin?: string;
  granularity?: string;
};

type ExtractedExtra = ExtraFilterQueryField & {
  filters: QueryObjectFilterClause[];
  extras: QueryObjectExtras;
  applied_time_extras: AppliedTimeExtras;
};

export default function extractExtras(formData: QueryFormData): ExtractedExtra {
  const applied_time_extras: AppliedTimeExtras = {};
  const filters: QueryObjectFilterClause[] = [];
  const extras: QueryObjectExtras = {};
  const extract: ExtractedExtra = {
    filters,
    extras,
    applied_time_extras,
  };

  const reservedColumnsToQueryField: Record<TimeColumnConfigKey, keyof ExtraFilterQueryField> = {
    __time_range: 'time_range',
    __time_col: 'granularity_sqla',
    __time_grain: 'time_grain_sqla',
    __time_origin: 'druid_time_origin',
    __granularity: 'granularity',
  };

  (formData.extra_filters || []).forEach(filter => {
    if (filter.col in reservedColumnsToQueryField) {
      const key = filter.col as TimeColumnConfigKey;
      const queryField = reservedColumnsToQueryField[key];
      extract[queryField] = filter.val as string;
      applied_time_extras[key] = filter.val as string;
    } else {
      filters.push(filter);
    }
  });

  // map to undeprecated names and remove deprecated fields
  if (isDruidFormData(formData) && !extract.druid_time_origin) {
    extras.druid_time_origin = formData.druid_time_origin;
    delete extract.druid_time_origin;
  } else {
    // SQL
    extras.time_grain_sqla = extract.time_grain_sqla || formData.time_grain_sqla;
    extract.granularity =
      extract.granularity_sqla || formData.granularity || formData.granularity_sqla;
    delete extract.granularity_sqla;
    delete extract.time_grain_sqla;
  }

  // map time range endpoints:
  if (formData.time_range_endpoints) extras.time_range_endpoints = formData.time_range_endpoints;

  return extract;
}
