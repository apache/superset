// DODO was here

import moment from 'moment';
// DODO commented out 45525377
// import {
//   getTimeFormatter,
//   getTimeFormatterForGranularity,
//   SMART_DATE_ID,
//   TimeGranularity,
// } from '@superset-ui/core';

export const parseMetricValue = (metricValue: number | string | null) => {
  if (typeof metricValue === 'string') {
    const dateObject = moment.utc(metricValue, moment.ISO_8601, true);
    if (dateObject.isValid()) {
      return dateObject.valueOf();
    }
    return null;
  }
  return metricValue;
};

// DODO commented out 45525377
// export const getDateFormatter = (
//   timeFormat: string,
//   granularity?: TimeGranularity,
//   fallbackFormat?: string | null,
// ) =>
//   timeFormat === SMART_DATE_ID
//     ? getTimeFormatterForGranularity(granularity)
//     : getTimeFormatter(timeFormat ?? fallbackFormat);
