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
import { useEffect, useRef, useState } from 'react';
import { InputNumber } from 'src/components/Input';
import { t, styled } from '@superset-ui/core';
import { debounce, parseInt } from 'lodash';
import ControlHeader from 'src/explore/components/ControlHeader';

type ValueType = (number | null)[];

export type BoundsControlProps = {
  onChange?: (value: ValueType) => void;
  value?: ValueType;
};

const StyledDiv = styled.div`
  display: flex;
`;

const MinInput = styled(InputNumber)`
  flex: 1;
  margin-right: ${({ theme }) => theme.gridUnit}px;
`;

const MaxInput = styled(InputNumber)`
  flex: 1;
  margin-left: ${({ theme }) => theme.gridUnit}px;
`;

const parseNumber = (value: undefined | number | string | null) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && Number.isNaN(parseInt(value)))
  ) {
    return null;
  }
  return Number(value);
};

export default function BoundsControl({
  onChange = () => {},
  value = [null, null],
  ...props
}: BoundsControlProps) {
  const [minMax, setMinMax] = useState<ValueType>([
    parseNumber(value[0]),
    parseNumber(value[1]),
  ]);
  const min = value[0];
  const max = value[1];
  const debouncedOnChange = useRef(debounce(onChange, 300)).current;

  const update = (mm: ValueType) => {
    setMinMax(mm);
    debouncedOnChange([
      mm[0] === undefined ? null : mm[0],
      mm[1] === undefined ? null : mm[1],
    ]);
  };

  useEffect(() => {
    setMinMax([parseNumber(min), parseNumber(max)]);
  }, [min, max]);

  const onMinChange = (value: number | string | undefined) => {
    update([parseNumber(value), minMax[1]]);
  };

  const onMaxChange = (value: number | string | undefined) => {
    update([minMax[0], parseNumber(value)]);
  };

  return (
    <div>
      <ControlHeader {...props} />
      <StyledDiv>
        <MinInput
          data-test="min-bound"
          placeholder={t('Min')}
          // emit (string | number | undefined)
          onChange={onMinChange}
          // accept (number | undefined)
          value={minMax[0] === null ? undefined : minMax[0]}
        />
        <MaxInput
          data-test="max-bound"
          placeholder={t('Max')}
          // emit (number | string | undefined)
          onChange={onMaxChange}
          // accept (number | undefined)
          value={minMax[1] === null ? undefined : minMax[1]}
        />
      </StyledDiv>
    </div>
  );
}
