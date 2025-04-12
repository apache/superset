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
import {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  RefObject,
} from 'react';

import { styled, t } from '@superset-ui/core';
import { RangePicker } from 'src/components/DatePicker';
import { FormLabel } from 'src/components/Form';
import { extendedDayjs } from 'src/utils/dates';
import { Dayjs } from 'dayjs';
import Loading from 'src/components/Loading';
import { AntdThemeProvider } from 'src/components/AntdThemeProvider';
import { useLocale } from 'src/hooks/useLocale';
import { BaseFilter, FilterHandler } from './Base';

interface DateRangeFilterProps extends BaseFilter {
  onSubmit: (val: number[]) => void;
  name: string;
}

type ValueState = [number, number];

const RangeFilterContainer = styled.div`
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  width: 360px;
`;

function DateRangeFilter(
  { Header, initialValue, onSubmit }: DateRangeFilterProps,
  ref: RefObject<FilterHandler>,
) {
  const [value, setValue] = useState<ValueState | null>(initialValue ?? null);
  const dayjsValue = useMemo((): [Dayjs, Dayjs] | null => {
    if (!value || (Array.isArray(value) && !value.length)) return null;
    return [extendedDayjs(value[0]), extendedDayjs(value[1])];
  }, [value]);

  const locale = useLocale();

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      setValue(null);
      onSubmit([]);
    },
  }));

  if (locale === null) {
    return <Loading position="inline-centered" />;
  }
  return (
    <AntdThemeProvider locale={locale}>
      <RangeFilterContainer>
        <FormLabel>{Header}</FormLabel>
        <RangePicker
          placeholder={[t('Start date'), t('End date')]}
          showTime
          value={dayjsValue}
          onCalendarChange={(dayjsRange: [Dayjs, Dayjs]) => {
            if (!dayjsRange?.[0]?.valueOf() || !dayjsRange?.[1]?.valueOf()) {
              setValue(null);
              onSubmit([]);
              return;
            }
            const changeValue = [
              dayjsRange[0]?.valueOf() ?? 0,
              dayjsRange[1]?.valueOf() ?? 0,
            ] as ValueState;
            setValue(changeValue);
            onSubmit(changeValue);
          }}
        />
      </RangeFilterContainer>
    </AntdThemeProvider>
  );
}

export default forwardRef(DateRangeFilter);
