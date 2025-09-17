/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import moment, { Moment } from 'moment';
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

export const dttmToMoment = (dttm: string): Moment => {
  if (dttm === 'now') {
    return moment().utc().startOf('second');
  }
  if (dttm === 'today') {
    return moment().utc().startOf('day');
  }
  return moment(dttm);
};

export const dttmToString = (dttm: string): string =>
  dttmToMoment(dttm).format(MOMENT_FORMAT);

export const customTimeRangeEncode = (customRange: CustomRangeType): string => {
  const { sinceDatetime, untilDatetime } = customRange;
  
  // Since we only support 'specific' mode now, always use the datetime values
  const since = dttmToString(sinceDatetime);
  const until = dttmToString(untilDatetime);
  return `${since} : ${until}`;
};
