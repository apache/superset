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
import { useSelector } from 'react-redux';
import { isEmpty, isEqual } from 'lodash';
import {
  BinaryAdhocFilter,
  css,
  ensureIsArray,
  fetchTimeRange,
  getTimeOffset,
  SimpleAdhocFilter,
  t,
} from '@superset-ui/core';
import ControlHeader, {
  ControlHeaderProps,
} from 'src/explore/components/ControlHeader';
import { RootState } from 'src/views/store';

const isTimeRangeEqual = (
  left: BinaryAdhocFilter[],
  right: BinaryAdhocFilter[],
) => isEqual(left, right);

type ComparisonRangeLabelProps = ControlHeaderProps & {
  multi?: boolean;
};

export const ComparisonRangeLabel = ({
  multi = true,
}: ComparisonRangeLabelProps) => {
  const [labels, setLabels] = useState<string[]>([]);
  const currentTimeRangeFilters = useSelector<RootState, BinaryAdhocFilter[]>(
    state =>
      state.explore.form_data.adhoc_filters.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      ),
    isTimeRangeEqual,
  );
  const shifts = useSelector<RootState, string[]>(
    state => state.explore.form_data.time_compare,
  );
  const startDate = useSelector<RootState, string>(
    state => state.explore.form_data.start_date_offset,
  );

  useEffect(() => {
    const shiftsArray = ensureIsArray(shifts);
    if (
      isEmpty(currentTimeRangeFilters) ||
      (isEmpty(shiftsArray) && !startDate)
    ) {
      setLabels([]);
    } else if (!isEmpty(shifts) || startDate) {
      const promises = currentTimeRangeFilters.map(filter => {
        const newShifts = getTimeOffset(filter, shiftsArray, startDate);

        return fetchTimeRange(
          filter.comparator,
          filter.subject,
          ensureIsArray(newShifts),
        );
      });
      Promise.all(promises).then(res => {
        // access the value property inside the res and set the labels with it in the state
        setLabels(res.map(r => r.value ?? ''));
      });
    }
  }, [currentTimeRangeFilters, shifts, startDate]);

  return labels.length ? (
    <>
      <ControlHeader label={t('Actual range for comparison')} />
      {labels.flat().map(label => (
        <>
          <div
            css={theme => css`
              font-size: ${theme.typography.sizes.m}px;
              color: ${theme.colors.grayscale.dark1};
            `}
            key={label}
          >
            {label}
          </div>
        </>
      ))}
    </>
  ) : null;
};
