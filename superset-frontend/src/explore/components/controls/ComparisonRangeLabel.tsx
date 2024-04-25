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

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { isEmpty, isEqual } from 'lodash';
import moment, { Moment } from 'moment';
import {
  BinaryAdhocFilter,
  css,
  ensureIsArray,
  fetchTimeRange,
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

const dttmToMoment = (dttm: string): Moment => {
  if (dttm === 'now') {
    return moment().utc().startOf('second');
  }
  if (dttm === 'today' || dttm === 'No filter') {
    return moment().utc().startOf('day');
  }
  if (dttm === 'Last week') {
    return moment().utc().startOf('day').subtract(7, 'day');
  }
  if (dttm === 'Last month') {
    return moment().utc().startOf('day').subtract(1, 'month');
  }
  if (dttm === 'Last quarter') {
    return moment().utc().startOf('day').subtract(1, 'quarter');
  }
  if (dttm === 'Last year') {
    return moment().utc().startOf('day').subtract(1, 'year');
  }
  if (dttm === 'previous calendar week') {
    return moment().utc().subtract(1, 'weeks').startOf('isoWeek');
  }
  if (dttm === 'previous calendar month') {
    return moment().utc().subtract(1, 'months').startOf('month');
  }
  if (dttm === 'previous calendar year') {
    return moment().utc().subtract(1, 'years').startOf('year');
  }
  if (dttm.includes('ago')) {
    const parts = dttm.split(' ');
    const amount = parseInt(parts[0], 10);
    const unit = parts[1] as
      | 'day'
      | 'week'
      | 'month'
      | 'year'
      | 'days'
      | 'weeks'
      | 'months'
      | 'years';
    return moment().utc().subtract(amount, unit);
  }

  return moment(dttm);
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
    if (isEmpty(currentTimeRangeFilters) || (isEmpty(shifts) && !startDate)) {
      setLabels([]);
    } else if (!isEmpty(shifts) || startDate) {
      const isCustom = shifts?.includes('custom');
      const isInherit = shifts?.includes('inherit');
      const promises = currentTimeRangeFilters.map(filter => {
        const customStartDate = isCustom && startDate;
        const customShift =
          customStartDate &&
          moment(dttmToMoment((filter as any).comparator.split(' : ')[0])).diff(
            moment(customStartDate),
            'days',
          ) + 1;

        const inInheritShift =
          isInherit &&
          moment(dttmToMoment((filter as any).comparator.split(' : ')[0])).diff(
            moment(dttmToMoment((filter as any).comparator.split(' : ')[1])),
            'days',
          ) + 1;
        let newShifts = shifts;
        if (isCustom) {
          newShifts = [`${customShift} days ago`];
        }
        if (isInherit) {
          newShifts = [`${inInheritShift} days ago`];
        }

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
