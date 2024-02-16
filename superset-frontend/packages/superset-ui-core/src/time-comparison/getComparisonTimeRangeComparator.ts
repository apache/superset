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

import { AdhocFilter } from '../types';
import { getComparisonTimeRangeInfo } from './getComparisonTimeRangeInfo';
import { getComparisonTimeShift } from './getComparisonTimeShift';
import { ComparisonTimeRangeType } from './types';

export const getComparisonTimeRangeComparator = (
  adhocFilters: AdhocFilter[],
  timeComparison: string,
  extraFormData: any,
  join = ':',
) => {
  const { since, until } = getComparisonTimeRangeInfo(
    adhocFilters,
    extraFormData,
  );

  if (timeComparison !== ComparisonTimeRangeType.Custom) {
    const [prevStartDateMoment, prevEndDateMoment] = getComparisonTimeShift(
      since,
      until,
      timeComparison,
    );

    return `${prevStartDateMoment?.format(
      'YYYY-MM-DDTHH:mm:ss',
    )} ${join} ${prevEndDateMoment?.format('YYYY-MM-DDTHH:mm:ss')}`.replace(
      /Z/g,
      '',
    );
  }

  return null;
};

export default getComparisonTimeRangeComparator;
