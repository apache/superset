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
import { useEffect, useState } from 'react';
import { NO_TIME_RANGE } from '@superset-ui/core';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { fetchTimeRange } from 'src/explore/components/controls/DateFilterControl';
import { Operators } from 'src/explore/constants';

interface Results {
  actualTimeRange?: string;
  title?: string;
}

export const useGetTimeRangeByAdhocFilter = (
  adhocFilter: AdhocFilter,
): Results => {
  const [actualTimeRange, setActualTimeRange] = useState<Results>({});

  useEffect(() => {
    if (
      adhocFilter.operator === Operators.TEMPORAL_RANGE &&
      adhocFilter.comparator === NO_TIME_RANGE
    ) {
      setActualTimeRange({
        actualTimeRange: NO_TIME_RANGE,
        title: NO_TIME_RANGE,
      });
    }

    if (
      adhocFilter.operator === Operators.TEMPORAL_RANGE &&
      adhocFilter.comparator !== NO_TIME_RANGE
    ) {
      fetchTimeRange(adhocFilter.comparator, adhocFilter.subject).then(
        ({ value, error }) => {
          if (error) {
            setActualTimeRange({
              actualTimeRange: `${adhocFilter.subject} (${adhocFilter.comparator})`,
              title: error,
            });
          } else {
            setActualTimeRange({
              actualTimeRange: value ?? '',
              title: adhocFilter.comparator,
            });
          }
        },
      );
    }
  }, [adhocFilter.comparator]);

  return actualTimeRange;
};
