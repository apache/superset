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
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { isEmpty, isEqual } from 'lodash';
import moment, { Moment } from 'moment';
import {
  parseDttmToDate,
  BinaryAdhocFilter,
  SimpleAdhocFilter,
  css,
  customTimeRangeDecode,
  computeCustomDateTime,
  fetchTimeRange,
} from '@superset-ui/core';
import { DatePicker } from 'antd';
import { RangePickerProps } from 'antd/lib/date-picker';
import { useSelector } from 'react-redux';

import ControlHeader from 'src/explore/components/ControlHeader';
import { RootState } from 'src/views/store';
import { DEFAULT_DATE_PATTERN } from '@superset-ui/chart-controls';

export interface TimeOffsetControlsProps {
  label?: ReactNode;
  startDate?: string;
  description?: string;
  hovered?: boolean;
  value?: Moment;
  onChange: (datetime: string) => void;
}
const MOMENT_FORMAT = 'YYYY-MM-DD';

const isTimeRangeEqual = (
  left: BinaryAdhocFilter[],
  right: BinaryAdhocFilter[],
) => isEqual(left, right);

const isStartDateEqual = (left: string, right: string) => isEqual(left, right);

export default function TimeOffsetControls({
  onChange,
  ...props
}: TimeOffsetControlsProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [formatedDate, setFormatedDate] = useState<moment.Moment | undefined>(
    undefined,
  );
  const [customStartDateInFilter, setCustomStartDateInFilter] = useState<
    moment.Moment | undefined
  >(undefined);
  const [formatedFilterDate, setFormatedFilterDate] = useState<
    moment.Moment | undefined
  >(undefined);
  const [savedStartDate, setSavedStartDate] = useState<string | null>(null);

  const currentTimeRangeFilters = useSelector<RootState, BinaryAdhocFilter[]>(
    state =>
      state.explore.form_data.adhoc_filters.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      ),
    isTimeRangeEqual,
  );

  const currentStartDate = useSelector<RootState, string>(
    state => state.explore.form_data.start_date_offset,
    isStartDateEqual,
  );

  useEffect(() => {
    if (savedStartDate !== currentStartDate) {
      setSavedStartDate(currentStartDate);
      onChange(moment(currentStartDate).format(MOMENT_FORMAT));
    }
  }, [currentStartDate]);

  const previousCustomFilter = useSelector<RootState, BinaryAdhocFilter[]>(
    state =>
      state.explore.form_data.adhoc_custom?.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      ),
    isTimeRangeEqual,
  );

  // let's use useCallback to compute the custom start date
  const customTimeRange = useCallback(
    (date: string) => {
      const customRange = customTimeRangeDecode(date);
      if (customRange.matchedFlag) {
        const { sinceDatetime, sinceMode, sinceGrain, sinceGrainValue } = {
          ...customRange.customRange,
        };
        let customStartDate: Date | null = null;
        if (sinceMode !== 'relative') {
          if (sinceMode === 'specific') {
            customStartDate = new Date(sinceDatetime);
          } else {
            customStartDate = parseDttmToDate(sinceDatetime, false, true);
          }
        } else {
          customStartDate = computeCustomDateTime(
            sinceDatetime,
            sinceGrain,
            sinceGrainValue,
          );
        }
        customStartDate?.setHours(0, 0, 0, 0);
        setCustomStartDateInFilter(moment(customStartDate));
      } else {
        setCustomStartDateInFilter(undefined);
      }
    },
    [setCustomStartDateInFilter],
  );

  useEffect(() => {
    if (!isEmpty(currentTimeRangeFilters)) {
      fetchTimeRange(
        currentTimeRangeFilters[0]?.comparator,
        currentTimeRangeFilters[0]?.subject,
      ).then(res => {
        const dates = res?.value?.match(DEFAULT_DATE_PATTERN);
        const [startDate, endDate] = dates ?? [];
        customTimeRange(`${startDate} : ${endDate}` ?? '');
        setFormatedFilterDate(moment(parseDttmToDate(startDate)));
      });
    } else {
      setCustomStartDateInFilter(undefined);
      setFormatedFilterDate(moment(parseDttmToDate('')));
    }
  }, [currentTimeRangeFilters, customTimeRange]);

  useEffect(() => {
    if (!savedStartDate && (previousCustomFilter || customStartDateInFilter)) {
      let date = '';
      if (isEmpty(previousCustomFilter)) {
        date = currentTimeRangeFilters[0]?.comparator.split(' : ')[0];
      } else if (
        previousCustomFilter[0]?.comparator.split(' : ')[0] !== 'No filter'
      ) {
        date = previousCustomFilter[0]?.comparator.split(' : ')[0];
      }
      if (customStartDateInFilter) {
        setStartDate(customStartDateInFilter.toString());
        setFormatedDate(moment(customStartDateInFilter));
      } else if (date) {
        setStartDate(date);
        setFormatedDate(moment(parseDttmToDate(date)));
      }
    } else if (savedStartDate) {
      setStartDate(savedStartDate);
      setFormatedDate(moment(parseDttmToDate(savedStartDate)));
    }
  }, [previousCustomFilter, savedStartDate, customStartDateInFilter]);

  useEffect(() => {
    // When switching offsets from inherit and the previous custom is no longer valid
    if (customStartDateInFilter) {
      if (formatedDate && formatedDate > customStartDateInFilter) {
        const resetDate = moment
          .utc(customStartDateInFilter)
          .subtract(1, 'day');
        setStartDate(resetDate.toString());
        setFormatedDate(resetDate);
        onChange(moment.utc(resetDate).format(MOMENT_FORMAT));
      }
    }
    if (
      formatedDate &&
      formatedFilterDate &&
      formatedDate > formatedFilterDate
    ) {
      const resetDate = moment.utc(formatedFilterDate).subtract(1, 'day');
      setStartDate(resetDate.toString());
      setFormatedDate(resetDate);
      onChange(moment.utc(resetDate).format(MOMENT_FORMAT));
    }
  }, [formatedFilterDate, formatedDate, customStartDateInFilter]);

  const disabledDate: RangePickerProps['disabledDate'] = current => {
    if (!customStartDateInFilter) {
      return formatedFilterDate
        ? current && current > formatedFilterDate
        : false;
    }
    return current && current > moment(customStartDateInFilter);
  };

  return startDate || formatedDate ? (
    <div>
      <ControlHeader {...props} />
      <DatePicker
        css={css`
          width: 100%;
        `}
        onChange={(datetime: Moment) =>
          onChange(datetime ? datetime.format(MOMENT_FORMAT) : '')
        }
        defaultPickerValue={
          startDate ? moment(formatedDate).subtract(1, 'day') : undefined
        }
        disabledDate={disabledDate}
        defaultValue={moment(formatedDate)}
        value={moment(formatedDate)}
      />
    </div>
  ) : null;
}
