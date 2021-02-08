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
import React, { useState, useMemo } from 'react';
import moment, { Moment } from 'moment';
import { styled } from '@superset-ui/core';
import { RangePicker as AntRangePicker } from 'src/common/components/DatePicker';
import { FilterContainer, BaseFilter, FilterTitle } from './Base';

interface DateRangeFilterProps extends BaseFilter {
  onSubmit: (val: number[]) => void;
  name: string;
}

type ValueState = [number, number];

const RangePicker = styled(AntRangePicker)`
  padding: 0 11px;
  transform: translateX(-7px);
`;

const RangeFilterContainer = styled(FilterContainer)`
  margin-right: 1em;
`;

export default function DateRangeFilter({
  Header,
  initialValue,
  onSubmit,
}: DateRangeFilterProps) {
  const [value, setValue] = useState<ValueState | null>(initialValue ?? null);
  const momentValue = useMemo((): [Moment, Moment] | null => {
    if (!value || (Array.isArray(value) && !value.length)) return null;
    return [moment(value[0]), moment(value[1])];
  }, [value]);

  return (
    <RangeFilterContainer>
      <FilterTitle>{Header}:</FilterTitle>
      <RangePicker
        showTime
        bordered={false}
        value={momentValue}
        onChange={momentRange => {
          if (!momentRange) {
            setValue(null);
            onSubmit([]);
            return;
          }
          const changeValue = [
            momentRange[0]?.valueOf() ?? 0,
            momentRange[1]?.valueOf() ?? 0,
          ] as ValueState;
          setValue(changeValue);
          onSubmit(changeValue);
        }}
      />
    </RangeFilterContainer>
  );
}
