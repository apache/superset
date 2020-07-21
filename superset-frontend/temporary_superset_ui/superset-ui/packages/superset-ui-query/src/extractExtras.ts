/* eslint-disable camelcase */
import { isDruidFormData, QueryFormData } from './types/QueryFormData';
import { QueryObject } from './types/Query';

export default function extractExtras(formData: QueryFormData): Partial<QueryObject> {
  const partialQueryObject: Partial<QueryObject> = {
    filters: formData.filters || [],
    extras: formData.extras || {},
  };

  const reservedColumnsToQueryField: Record<string, keyof QueryObject> = {
    __time_range: 'time_range',
    __time_col: 'granularity_sqla',
    __time_grain: 'time_grain_sqla',
    __time_origin: 'druid_time_origin',
    __granularity: 'granularity',
  };

  (formData.extra_filters || []).forEach(filter => {
    if (filter.col in reservedColumnsToQueryField) {
      const queryField = reservedColumnsToQueryField[filter.col];
      partialQueryObject[queryField] = filter.val;
    } else {
      // @ts-ignore
      partialQueryObject.filters.push(filter);
    }
  });

  // map to undeprecated names and remove deprecated fields
  if (isDruidFormData(formData) && !partialQueryObject.druid_time_origin) {
    partialQueryObject.extras = {
      druid_time_origin: formData.druid_time_origin,
    };
    delete partialQueryObject.druid_time_origin;
  } else {
    // SQL
    partialQueryObject.extras = {
      ...partialQueryObject.extras,
      time_grain_sqla: partialQueryObject.time_grain_sqla || formData.time_grain_sqla,
    };
    partialQueryObject.granularity =
      partialQueryObject.granularity_sqla || formData.granularity || formData.granularity_sqla;
    delete partialQueryObject.granularity_sqla;
    delete partialQueryObject.time_grain_sqla;
  }
  return partialQueryObject;
}
