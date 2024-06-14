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
import { ReactNode } from 'react';
import { isEqual } from 'lodash';
import moment, { Moment } from 'moment';
import {
  parseDttmToDate,
  BinaryAdhocFilter,
  SimpleAdhocFilter,
  css,
} from '@superset-ui/core';
import { DatePicker } from 'antd';
import { RangePickerProps } from 'antd/lib/date-picker';
import { useSelector } from 'react-redux';

import ControlHeader from 'src/explore/components/ControlHeader';
import { RootState } from 'src/views/store';

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

export default function TimeOffsetControls({
  onChange,
  ...props
}: TimeOffsetControlsProps) {
  const currentTimeRangeFilters = useSelector<RootState, BinaryAdhocFilter[]>(
    state =>
      state.explore.form_data.adhoc_filters.filter(
        (adhoc_filter: SimpleAdhocFilter) =>
          adhoc_filter.operator === 'TEMPORAL_RANGE',
      ),
    isTimeRangeEqual,
  );

  const startDate = currentTimeRangeFilters[0]?.comparator.split(' : ')[0];

  const formatedDate = moment(parseDttmToDate(startDate));
  const disabledDate: RangePickerProps['disabledDate'] = current =>
    current && current > formatedDate;

  return (
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
        defaultValue={formatedDate}
      />
    </div>
  );
}
