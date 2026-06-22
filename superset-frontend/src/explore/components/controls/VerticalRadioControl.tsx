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
import { type ReactNode } from 'react';
import { css, useTheme } from '@apache-superset/core/theme';
import { JsonValue } from '@superset-ui/core';
import { Radio } from '@superset-ui/core/components/Radio';
import { Space } from '@superset-ui/core/components/Space';
import { Tooltip } from '@superset-ui/core/components/Tooltip';
import { Icons } from '@superset-ui/core/components/Icons';
import ControlHeader from '../ControlHeader';

interface RadioOption {
  value: JsonValue;
  label: ReactNode;
  disabled?: boolean;
  tooltip?: string;
}

type RadioOptionTuple = [JsonValue, ReactNode];

interface VerticalRadioControlProps {
  value?: JsonValue;
  label?: ReactNode;
  description?: ReactNode;
  hovered?: boolean;
  options: (RadioOption | RadioOptionTuple)[];
  onChange: (value: JsonValue) => void;
  validationErrors?: string[];
}

function normalizeOption(option: RadioOption | RadioOptionTuple): RadioOption {
  if (Array.isArray(option)) {
    return { value: option[0], label: option[1] };
  }
  return option;
}

export default function VerticalRadioControl({
  value: initialValue,
  options,
  onChange,
  ...props
}: VerticalRadioControlProps) {
  const theme = useTheme();
  const normalizedOptions = options.map(normalizeOption);
  const currentValue = initialValue ?? normalizedOptions[0]?.value;

  return (
    <div
      css={css`
        .ant-radio-wrapper {
          display: flex;
          align-items: center;
        }
      `}
    >
      <ControlHeader {...props} />
      <Radio.Group
        value={currentValue}
        onChange={e => onChange(e.target.value)}
      >
        <Space direction="vertical">
          {normalizedOptions.map(
            ({ value: val, label, disabled = false, tooltip }) => (
              <Radio key={JSON.stringify(val)} value={val} disabled={disabled}>
                {label}
                {tooltip && (
                  <Tooltip title={tooltip} placement="right">
                    <Icons.InfoCircleOutlined
                      css={css`
                        margin-left: 4px;
                        font-size: 12px;
                        color: ${disabled
                          ? theme.colorTextDisabled
                          : theme.colorTextTertiary};
                        cursor: help;
                      `}
                    />
                  </Tooltip>
                )}
              </Radio>
            ),
          )}
        </Space>
      </Radio.Group>
    </div>
  );
}
