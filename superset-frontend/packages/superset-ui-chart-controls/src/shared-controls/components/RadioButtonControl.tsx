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
import { t } from '@apache-superset/core';
import { JsonValue } from '@superset-ui/core';
import { Radio, Tooltip, TooltipPlacement } from '@superset-ui/core/components';
import { ControlHeader } from '../../components/ControlHeader';

export interface RadioButtonOptionObject {
  value: JsonValue;
  label: Exclude<ReactNode, null | undefined | boolean>;
  disabled?: boolean;
  tooltip?: string;
  tooltipPlacement?: TooltipPlacement;
}

export type RadioButtonOption =
  | [JsonValue, Exclude<ReactNode, null | undefined | boolean>]
  | RadioButtonOptionObject;

export interface RadioButtonControlProps {
  label?: ReactNode;
  description?: string;
  options: RadioButtonOption[];
  hovered?: boolean;
  value?: JsonValue;
  onChange: (opt: JsonValue) => void;
}

function normalizeOption(option: RadioButtonOption): RadioButtonOptionObject {
  if (Array.isArray(option)) {
    return {
      value: option[0],
      label: option[1],
    };
  }
  return option;
}

export default function RadioButtonControl({
  value: initialValue,
  options,
  onChange,
  ...props
}: RadioButtonControlProps) {
  const normalizedOptions = options.map(normalizeOption);
  const currentValue = initialValue || normalizedOptions[0].value;

  return (
    <div>
      <div
        role="tablist"
        aria-label={typeof props.label === 'string' ? props.label : undefined}
      >
        <ControlHeader {...props} />
        <Radio.Group
          value={currentValue}
          onChange={e => onChange(e.target.value)}
        >
          {normalizedOptions.map(
            ({
              value: val,
              label,
              disabled = false,
              tooltip,
              tooltipPlacement = 'top',
            }) => {
              const button = (
                <Radio.Button
                  key={JSON.stringify(val)}
                  value={val}
                  disabled={disabled}
                  aria-label={typeof label === 'string' ? label : undefined}
                  id={`tab-${val}`}
                  type="button"
                  aria-selected={val === currentValue}
                  className={`btn btn-default ${
                    val === currentValue ? 'active' : ''
                  }`}
                  onClick={e => {
                    e.currentTarget?.focus();
                    onChange(val);
                  }}
                >
                  {label}
                </Radio.Button>
              );

              if (tooltip) {
                return (
                  <Tooltip
                    key={JSON.stringify(val)}
                    title={tooltip}
                    placement={tooltipPlacement}
                  >
                    {button}
                  </Tooltip>
                );
              }

              return button;
            },
          )}
        </Radio.Group>
      </div>
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          left: '-9999px',
          height: '1px',
          width: '1px',
          overflow: 'hidden',
        }}
      >
        {t(
          '%s tab selected',
          normalizedOptions.find(({ value: val }) => val === currentValue)
            ?.label,
        )}
      </div>
    </div>
  );
}
