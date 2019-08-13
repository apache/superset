/* eslint-disable camelcase */
import { QueryFormData, isDruidFormData } from './types/QueryFormData';
import { QueryObjectExtras } from './types/Query';

export default function processExtras(formData: QueryFormData): QueryObjectExtras {
  const { where = '' } = formData;

  if (isDruidFormData(formData)) {
    const { druid_time_origin, having_druid } = formData;

    return { druid_time_origin, having_druid, where };
  }

  const { time_grain_sqla, having } = formData;

  return { having, time_grain_sqla, where };
}
