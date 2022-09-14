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
import React, { useState, forwardRef, useImperativeHandle } from 'react';
import moment, { Moment } from 'moment';
import { styled } from '@superset-ui/core';
import { DatePicker } from 'src/components/DatePicker';
import { FormLabel } from 'src/components/Form';
import { BaseFilter, FilterHandler } from './Base';

interface DateFilterProps extends BaseFilter {
  onSubmit: (val: ValueState) => void;
  name: string;
}

type ValueState = string | null;

const DateFilterContainer = styled.div`
  display: inline-flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  width: 150px;
`;

function DateFilter(
  { Header, initialValue, onSubmit }: DateFilterProps,
  ref: React.RefObject<FilterHandler>,
) {
  const [value, setValue] = useState<Moment | null>(initialValue ?? null);

  useImperativeHandle(ref, () => ({
    clearFilter: () => {
      setValue(null);
      onSubmit(null);
    },
  }));

  return (
    <DateFilterContainer>
      <FormLabel>{Header}</FormLabel>
      <DatePicker
        value={value}
        onChange={momentRange => {
          if (!momentRange) {
            setValue(null);
            onSubmit(null);
            return;
          }
          setValue(momentRange);
          onSubmit(moment(momentRange).format('YYYY-MM-DD'));
        }}
      />
    </DateFilterContainer>
  );
}

export default forwardRef(DateFilter);
