/* eslint-disable camelcase */
import { isDruidFormData, QueryFormData } from './types/QueryFormData';
import { QueryObject } from './types/Query';
import { AppliedTimeExtras, TimeColumnConfigKey } from './types/Time';

export default function extractExtras(formData: QueryFormData): Partial<QueryObject> {
  const applied_time_extras: AppliedTimeExtras = {};
  const { extras = {}, filters = [] } = formData;
  const partialQueryObject: Partial<QueryObject> = {
    filters,
    extras,
    applied_time_extras,
  };

  const reservedColumnsToQueryField: Record<TimeColumnConfigKey, keyof QueryObject> = {
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
      partialQueryObject[queryField] = filter.val;
      applied_time_extras[key] = filter.val as string;
    } else {
      filters.push(filter);
    }
  });

  // map to undeprecated names and remove deprecated fields
  if (isDruidFormData(formData) && !partialQueryObject.druid_time_origin) {
    extras.druid_time_origin = formData.druid_time_origin;
    delete partialQueryObject.druid_time_origin;
  } else {
    // SQL
    extras.time_grain_sqla = partialQueryObject.time_grain_sqla || formData.time_grain_sqla;
    partialQueryObject.granularity =
      partialQueryObject.granularity_sqla || formData.granularity || formData.granularity_sqla;
    delete partialQueryObject.granularity_sqla;
    delete partialQueryObject.time_grain_sqla;
  }

  // map time range endpoints:
  if (formData.time_range_endpoints) extras.time_range_endpoints = formData.time_range_endpoints;

  return partialQueryObject;
}
