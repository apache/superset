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
import { extendedDayjs } from 'src/utils/dates';
import {
  parseDttmToDate,
  BinaryAdhocFilter,
  SimpleAdhocFilter,
  customTimeRangeDecode,
  computeCustomDateTime,
  fetchTimeRange,
} from '@superset-ui/core';
import { DatePicker } from 'src/components/DatePicker';
import { RangePickerProps } from 'antd-v5/es/date-picker';
import { useSelector } from 'react-redux';

import ControlHeader from 'src/explore/components/ControlHeader';
import { RootState } from 'src/views/store';
import {
  DEFAULT_DATE_PATTERN,
  INVALID_DATE,
} from '@superset-ui/chart-controls';
import { Dayjs } from 'dayjs';

export interface TimeOffsetControlsProps {
  label?: ReactNode;
  startDate?: string;
  description?: string;
  hovered?: boolean;
  value?: Dayjs;
  onChange: (datetime: string) => void;
}
const DAYJS_FORMAT = 'YYYY-MM-DD';

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
  const [formatedDate, setFormatedDate] = useState<Dayjs | undefined>(
    undefined,
  );
  const [customStartDateInFilter, setCustomStartDateInFilter] = useState<
    Dayjs | undefined
  >(undefined);
  const [formatedFilterDate, setFormatedFilterDate] = useState<
    Dayjs | undefined
  >(undefined);
  const [savedStartDate, setSavedStartDate] = useState<string | null>(null);
  const [isDateSelected, setIsDateSelected] = useState<boolean>(true);

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
      if (currentStartDate !== INVALID_DATE) {
        onChange(extendedDayjs(currentStartDate).format(DAYJS_FORMAT));
        setIsDateSelected(true);
      } else {
        setIsDateSelected(false);
      }
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
        setCustomStartDateInFilter(extendedDayjs(customStartDate));
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
        customTimeRange(`${startDate} : ${endDate}`);
        setFormatedFilterDate(extendedDayjs(parseDttmToDate(startDate)));
      });
    } else {
      setCustomStartDateInFilter(undefined);
      setFormatedFilterDate(extendedDayjs(parseDttmToDate('')));
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
        setFormatedDate(extendedDayjs(customStartDateInFilter));
      } else if (date) {
        setStartDate(date);
        setFormatedDate(extendedDayjs(parseDttmToDate(date)));
      }
    } else if (savedStartDate) {
      if (savedStartDate !== INVALID_DATE) {
        setStartDate(savedStartDate);
        setFormatedDate(extendedDayjs(parseDttmToDate(savedStartDate)));
      }
    }
  }, [previousCustomFilter, savedStartDate, customStartDateInFilter]);

  useEffect(() => {
    // When switching offsets from inherit and the previous custom is no longer valid
    if (customStartDateInFilter) {
      if (formatedDate && formatedDate > customStartDateInFilter) {
        const resetDate = extendedDayjs
          .utc(customStartDateInFilter)
          .subtract(1, 'day');
        setStartDate(resetDate.toString());
        setFormatedDate(resetDate);
        onChange(extendedDayjs.utc(resetDate).format(DAYJS_FORMAT));
        setIsDateSelected(true);
      }
    }
    if (
      formatedDate &&
      formatedFilterDate &&
      formatedDate > formatedFilterDate
    ) {
      const resetDate = extendedDayjs
        .utc(formatedFilterDate)
        .subtract(1, 'day');
      setStartDate(resetDate.toString());
      setFormatedDate(resetDate);
      onChange(extendedDayjs.utc(resetDate).format(DAYJS_FORMAT));
      setIsDateSelected(true);
    }
  }, [formatedFilterDate, formatedDate, customStartDateInFilter]);

  const disabledDate: RangePickerProps['disabledDate'] = current => {
    if (!customStartDateInFilter) {
      return formatedFilterDate
        ? current && current > formatedFilterDate
        : false;
    }
    return current && current > extendedDayjs(customStartDateInFilter);
  };

  return startDate || formatedDate ? (
    <div>
      <ControlHeader {...props} />
      <DatePicker
        onChange={(datetime: Dayjs) =>
          onChange(datetime ? datetime.format(DAYJS_FORMAT) : '')
        }
        defaultPickerValue={
          startDate ? extendedDayjs(formatedDate).subtract(1, 'day') : undefined
        }
        disabledDate={disabledDate}
        defaultValue={extendedDayjs(formatedDate)}
        value={isDateSelected ? extendedDayjs(formatedDate) : null}
      />
    </div>
  ) : null;
}
