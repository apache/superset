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
import { useId, useRef } from 'react';
import { styled } from '@apache-superset/core/theme';
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
  const pendingValueRef = useRef<NumberValueType>(value);
  const uniqueId = useId();
  const inputId = rest.name || uniqueId;

  const handleChange = (val: string | number | null) => {
    pendingValueRef.current = parseValue(val);
  };

  const handleBlur = () => {
    onChange?.(pendingValueRef.current);
  };

  const hasErrors =
    rest.validationErrors && rest.validationErrors.length > 0;
  // WCAG 3.3.1: the visually hidden live-region inside ControlHeader carries
  // the id and role="alert"; this wrapper only needs to point the input at
  // that same id via aria-describedby. Sharing one id per control avoids
  // duplicate DOM ids and duplicate screen-reader announcements.
  const errorId = hasErrors ? `${inputId}-error` : undefined;

  return (
    <FullWidthDiv>
      <ControlHeader {...rest} errorId={errorId} />
      <FullWidthInputNumber
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        aria-label={rest.label}
        aria-invalid={hasErrors || undefined}
        aria-describedby={errorId}
        id={inputId}
      />
      {hasErrors && (
        <span
          style={{ color: 'red', fontSize: '12px', display: 'block', marginTop: '4px' }}
        >
          {rest.validationErrors!.join('. ')}
        </span>
      )}
    </FullWidthDiv>
  );
}
