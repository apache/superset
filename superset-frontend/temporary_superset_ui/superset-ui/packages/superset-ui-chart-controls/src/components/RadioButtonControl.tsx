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
import React, { ReactText, ReactNode, MouseEvent, useCallback } from 'react';
import styled from '@superset-ui/style';
import { InfoTooltipWithTrigger } from './InfoTooltipWithTrigger';

export interface RadioButtonOption {
  label: string;
  value: ReactText;
}

export interface RadioButtonControlProps {
  label?: ReactNode;
  description?: string;
  options: RadioButtonOption[];
  hovered?: boolean;
  value?: string;
  onChange: (opt: string) => void;
}

const Styles = styled.div`
  .btn:focus {
    outline: none;
  }
  .control-label + .btn-group {
    margin-top: 1px;
  }
  .btn-group .btn.active {
    background: ${({ theme }) => theme.colors.secondary.light5};
    box-shadow: none;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

export default function RadioButtonControl({
  label: controlLabel,
  description,
  value: initialValue,
  hovered,
  options,
  onChange,
}: RadioButtonControlProps) {
  const currentValue = initialValue || options[0].value;
  const onClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      onChange(e.currentTarget.value);
    },
    [onChange],
  );
  return (
    <Styles>
      {controlLabel && (
        <div className="control-label">
          {controlLabel}{' '}
          {hovered && description && (
            <InfoTooltipWithTrigger tooltip={description} placement="top" />
          )}
        </div>
      )}
      <div className="btn-group btn-group-sm">
        {options.map(({ label, value }, i) => (
          <button
            key={value}
            type="button"
            className={`btn btn-default ${options[i].value === currentValue ? 'active' : ''}`}
            value={value}
            onClick={onClick}
          >
            {label}
          </button>
        ))}
      </div>
    </Styles>
  );
}
