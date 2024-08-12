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
import moment from 'moment';
import {
  BinaryAdhocFilter,
  css,
  ensureIsArray,
  fetchTimeRange,
  getTimeOffset,
  parseDttmToDate,
  SimpleAdhocFilter,
  t,
} from '@superset-ui/core';
import ControlHeader, {
  ControlHeaderProps,
} from 'src/explore/components/ControlHeader';
import { RootState } from 'src/views/store';

const MOMENT_FORMAT = 'YYYY-MM-DD';

const isTimeRangeEqual = (
  left: BinaryAdhocFilter[],
  right: BinaryAdhocFilter[],
) => isEqual(left, right);

const isShiftEqual = (left: string[], right: string[]) => isEqual(left, right);

type ComparisonRangeLabelProps = ControlHeaderProps & {
  multi?: boolean;
};

const oldChoices = {
  r: 'inherit',
  y: '1 year ago',
  m: '1 month ago',
  w: '1 week ago',
  c: 'custom',
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
  const previousCustomFilter = useSelector<RootState, BinaryAdhocFilter[]>(
    state =>
      state.explore.form_data.adhoc_custom?.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      ),
    isTimeRangeEqual,
  );
  const shifts = useSelector<RootState, string[]>(state => {
    const formData = state.explore.form_data || {};
    if (!formData?.time_compare) {
      const previousTimeComparison = formData.time_comparison || '';
      if (oldChoices.hasOwnProperty(previousTimeComparison)) {
        const previousChoice = oldChoices[previousTimeComparison];
        return [previousChoice];
      }
    }
    return formData?.time_compare;
  }, isShiftEqual);
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
      let useStartDate = startDate;
      if (!startDate && !isEmpty(previousCustomFilter)) {
        useStartDate = previousCustomFilter[0]?.comparator.split(' : ')[0];
        useStartDate = moment(parseDttmToDate(useStartDate)).format(
          MOMENT_FORMAT,
        );
      }
      const promises = currentTimeRangeFilters.map(filter => {
        const newShifts = getTimeOffset({
          timeRangeFilter: filter,
          shifts: shiftsArray,
          startDate: useStartDate,
          includeFutureOffsets: false, // So we don't trigger requests for future dates
        });

        if (!isEmpty(newShifts)) {
          return fetchTimeRange(
            filter.comparator,
            filter.subject,
            ensureIsArray(newShifts),
          );
        }
        return Promise.resolve({ value: '' });
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
