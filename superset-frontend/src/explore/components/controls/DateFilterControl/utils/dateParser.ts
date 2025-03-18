// DODO was here
// import moment, { Moment } from 'moment';
import { dttmToMoment } from '@superset-ui/core'; // DODO added 44211759
import { CustomRangeType } from 'src/explore/components/controls/DateFilterControl/types';
import { MOMENT_FORMAT } from './constants';

/**
 * RegExp to test a string for a full ISO 8601 Date
 * Does not do any sort of date validation, only checks if the string is according to the ISO 8601 spec.
 *  YYYY-MM-DDThh:mm:ss
 *  YYYY-MM-DDThh:mm:ssTZD
 *  YYYY-MM-DDThh:mm:ss.sTZD
 * @see: https://www.w3.org/TR/NOTE-datetime
 */
const iso8601 = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:(?:[+-]\d\d:\d\d)|Z)?`;
const datetimeConstant = String.raw`(?:TODAY|NOW)`;

export const ISO8601_AND_CONSTANT = RegExp(
  String.raw`^${iso8601}$|^${datetimeConstant}$`,
  'i',
);

const SPECIFIC_MODE = ['specific', 'today', 'now'];

// DODO commented out 44211759
// export const dttmToMoment = (dttm: string): Moment => {
//   if (dttm === 'now') {
//     return moment().utc().startOf('second');
//   }
//   if (dttm === 'today') {
//     return moment().utc().startOf('day');
//   }
//   return moment(dttm);
// };

export const dttmToString = (dttm: string): string =>
  dttmToMoment(dttm).format(MOMENT_FORMAT);

export const customTimeRangeEncode = (customRange: CustomRangeType): string => {
  const {
    sinceDatetime,
    sinceMode,
    sinceGrain,
    sinceGrainValue,
    untilDatetime,
    untilMode,
    untilGrain,
    untilGrainValue,
    anchorValue,
  } = { ...customRange };
  // specific : specific
  if (SPECIFIC_MODE.includes(sinceMode) && SPECIFIC_MODE.includes(untilMode)) {
    const since =
      sinceMode === 'specific' ? dttmToString(sinceDatetime) : sinceMode;
    const until =
      untilMode === 'specific' ? dttmToString(untilDatetime) : untilMode;
    return `${since} : ${until}`;
  }

  // specific : relative
  if (SPECIFIC_MODE.includes(sinceMode) && untilMode === 'relative') {
    const since =
      sinceMode === 'specific' ? dttmToString(sinceDatetime) : sinceMode;
    const until = `DATEADD(DATETIME("${since}"), ${untilGrainValue}, ${untilGrain})`;
    return `${since} : ${until}`;
  }

  // relative : specific
  if (sinceMode === 'relative' && SPECIFIC_MODE.includes(untilMode)) {
    const until =
      untilMode === 'specific' ? dttmToString(untilDatetime) : untilMode;
    // DODO added 44211759
    const untilStart = dttmToMoment(until)
      .startOf('date')
      .format(MOMENT_FORMAT);
    // DODO changed 44211759
    const since = `DATEADD(DATETIME("${untilStart}"), ${-Math.abs(
      sinceGrainValue,
    )}, ${sinceGrain})`;
    return `${since} : ${until}`;
  }

  // relative : relative
  const since = `DATEADD(DATETIME("${anchorValue}"), ${-Math.abs(
    sinceGrainValue,
  )}, ${sinceGrain})`;
  const until = `DATEADD(DATETIME("${anchorValue}"), ${untilGrainValue}, ${untilGrain})`;
  return `${since} : ${until}`;
};
