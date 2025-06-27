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
import { styled } from '@superset-ui/core';
import { InputNumber } from '@superset-ui/core/components/Input';
import ControlHeader, { ControlHeaderProps } from '../../ControlHeader';

type NumberValueType = number | undefined;

export interface NumberControlProps extends ControlHeaderProps {
  onChange?: (value: NumberValueType) => void;
  value?: NumberValueType;
  label?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  disabled?: boolean;
}

const FullWidthDiv = styled.div`
  width: 100%;
`;

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

function parseValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

export default function NumberControl({
  min,
  max,
  step,
  placeholder,
  value,
  onChange,
  disabled,
  ...rest
}: NumberControlProps) {
  return (
    <FullWidthDiv>
      <ControlHeader {...rest} />
      <FullWidthInputNumber
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={value => onChange?.(parseValue(value))}
        disabled={disabled}
        aria-label={rest.label}
      />
    </FullWidthDiv>
  );
}
