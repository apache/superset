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
import { useCallback, useId, type ReactNode } from 'react';
import { styled, css } from '@apache-superset/core/theme';
import { Button, Checkbox } from '@superset-ui/core/components';
import ControlHeader from '../ControlHeader';

interface CheckboxControlProps {
  value?: boolean;
  label?: ReactNode;
  name?: string;
  description?: ReactNode;
  hovered?: boolean;
  onChange?: (value: boolean) => void;
  validationErrors?: string[];
  placeholder?: string;
  debounceDelay?: number;
  disabled?: boolean;
  disabledReason?: string;
  resetLabel?: string;
}

const CheckBoxControlWrapper = styled.div`
  ${({ theme }) => css`
    .ControlHeader label {
      color: ${theme.colorText};
    }
    span:has(label) {
      padding-right: ${theme.sizeUnit * 2}px;
    }
    .ant-checkbox-wrapper {
      font-size: ${theme.fontSizeSM}px;
    }
  `}
`;

export default function CheckboxControl({
  value = false,
  label,
  disabled = false,
  disabledReason,
  resetLabel,
  onChange = () => {},
  ...restProps
}: CheckboxControlProps): JSX.Element {
  const explanationId = useId();
  const handleChange = useCallback((): void => {
    if (!disabled) {
      onChange(!value);
    }
  }, [disabled, onChange, value]);

  const checkbox = (
    <Checkbox
      onChange={handleChange}
      checked={!!value}
      disabled={disabled}
      aria-describedby={disabled && disabledReason ? explanationId : undefined}
    >
      {disabled ? label : undefined}
    </Checkbox>
  );
  const explanation = disabled && disabledReason && (
    <p id={explanationId}>{disabledReason}</p>
  );

  if (label) {
    return (
      <CheckBoxControlWrapper>
        {disabled ? (
          checkbox
        ) : (
          <ControlHeader
            {...restProps}
            label={label}
            leftNode={checkbox}
            onClick={handleChange}
          />
        )}
        {explanation}
        {disabled && value && resetLabel && (
          <Button buttonSize="small" onClick={() => onChange(false)}>
            {resetLabel}
          </Button>
        )}
      </CheckBoxControlWrapper>
    );
  }
  if (explanation) {
    return (
      <CheckBoxControlWrapper>
        {checkbox}
        {explanation}
      </CheckBoxControlWrapper>
    );
  }
  return checkbox;
}
