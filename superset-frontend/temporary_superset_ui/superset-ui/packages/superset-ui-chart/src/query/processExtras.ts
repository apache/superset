/* eslint-disable camelcase */
import { ChartFormData, isDruidFormData } from '../types/ChartFormData';
import { QueryObjectExtras } from '../types/Query';

export default function processExtras(formData: ChartFormData): QueryObjectExtras {
  const { where = '' } = formData;

  if (isDruidFormData(formData)) {
    const { druid_time_origin, having_druid } = formData;

    return { druid_time_origin, having_druid, where };
  }

  const { time_grain_sqla, having } = formData;

  return { having, time_grain_sqla, where };
}
