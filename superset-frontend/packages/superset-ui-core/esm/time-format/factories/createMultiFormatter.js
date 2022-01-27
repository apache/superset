(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import { utcFormat, timeFormat } from 'd3-time-format';
import { utcUtils, localTimeUtils } from '../utils/d3Time';
import TimeFormatter from '../TimeFormatter';












export default function createMultiFormatter({
  id,
  label,
  description,
  formats = {},
  useLocalTime = false })






{
  const {
    millisecond = '.%L',
    second = ':%S',
    minute = '%I:%M',
    hour = '%I %p',
    day = '%a %d',
    week = '%b %d',
    month = '%B',
    year = '%Y' } =
  formats;

  const format = useLocalTime ? timeFormat : utcFormat;

  const formatMillisecond = format(millisecond);
  const formatSecond = format(second);
  const formatMinute = format(minute);
  const formatHour = format(hour);
  const formatDay = format(day);
  const formatFirstDayOfWeek = format(week);
  const formatMonth = format(month);
  const formatYear = format(year);

  const {
    hasMillisecond,
    hasSecond,
    hasMinute,
    hasHour,
    isNotFirstDayOfMonth,
    isNotFirstDayOfWeek,
    isNotFirstMonth } =
  useLocalTime ? localTimeUtils : utcUtils;

  function multiFormatFunc(date) {
    if (hasMillisecond(date)) {
      return formatMillisecond;
    }
    if (hasSecond(date)) {
      return formatSecond;
    }
    if (hasMinute(date)) {
      return formatMinute;
    }
    if (hasHour(date)) {
      return formatHour;
    }
    if (isNotFirstDayOfMonth(date)) {
      return isNotFirstDayOfWeek(date) ? formatDay : formatFirstDayOfWeek;
    }
    if (isNotFirstMonth(date)) {
      return formatMonth;
    }

    return formatYear;
  }

  return new TimeFormatter({
    description,
    formatFunc: (date) => multiFormatFunc(date)(date),
    id,
    label,
    useLocalTime });

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(createMultiFormatter, "createMultiFormatter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/time-format/factories/createMultiFormatter.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();