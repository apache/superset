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

import moment from 'moment';
import { AdhocFilter } from '../types';
import getComparisonTimeRangeInfo from './getComparisonTimeRangeInfo';

export const getComparisonTimeRangeText = (
  adhocFilters: AdhocFilter[],
  extraFormData: any,
): string => {
  const { timeRange } = getComparisonTimeRangeInfo(adhocFilters, extraFormData);

  if (timeRange) {
    const [start, end] = timeRange.split(' : ').map(dateStr => {
      const formattedDate = moment(dateStr).format('YYYY-MM-DDTHH:mm:ss');
      return formattedDate.replace(/Z/g, '');
    });

    return `${start} - ${end}`;
  }

  return '';
};

export default getComparisonTimeRangeText;
