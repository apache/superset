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
import { JsonValue, t } from '@superset-ui/core';
import { Radio } from '@superset-ui/core/components';
import { ControlHeader } from '../../components/ControlHeader';

// [value, label]
export type RadioButtonOption = [
  JsonValue,
  Exclude<ReactNode, null | undefined | boolean>,
];

export interface RadioButtonControlProps {
  label?: ReactNode;
  description?: string;
  options: RadioButtonOption[];
  hovered?: boolean;
  value?: JsonValue;
  onChange: (opt: RadioButtonOption[0]) => void;
}

export default function RadioButtonControl({
  value: initialValue,
  options,
  onChange,
  ...props
}: RadioButtonControlProps) {
  const currentValue = initialValue || options[0][0];
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
          {options.map(([val, label]) => (
            <Radio.Button
              // role="tab"
              key={JSON.stringify(val)}
              value={val}
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
          ))}
        </Radio.Group>
      </div>
      {/* accessibility begin */}
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
          options.find(([val]) => val === currentValue)?.[1],
        )}
      </div>
      {/* accessibility end */}
    </div>
  );
}
