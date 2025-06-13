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
import { JsonValue, t, useTheme } from '@superset-ui/core';
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
  const theme = useTheme();
  return (
    <div
      css={{
        '.btn svg': {
          position: 'relative',
          top: '0.2em',
        },
        '.btn:focus': {
          outline: 'none',
        },
        '.control-label': {
          color: theme.colors.grayscale.base,
          marginBottom: theme.gridUnit,
        },
        '.control-label + .btn-group': {
          marginTop: '1px',
        },
        '.btn-group .btn-default': {
          color: theme.colors.grayscale.dark1,
        },
        '.btn-group .btn.active': {
          background: theme.colors.grayscale.light4,
          fontWeight: theme.typography.weights.bold,
          boxShadow: 'none',
        },
      }}
      role="tablist"
      aria-label={typeof props.label === 'string' ? props.label : undefined}
    >
      <ControlHeader {...props} />
      <div className="btn-group btn-group-sm">
        {options.map(([val, label]) => (
          <button
            aria-label={typeof label === 'string' ? label : undefined}
            id={`tab-${val}`}
            key={JSON.stringify(val)}
            type="button"
            aria-selected={val === currentValue}
            role="tab"
            className={`btn btn-default ${
              val === currentValue ? 'active' : ''
            }`}
            onClick={e => {
              e.currentTarget?.focus();
              onChange(val);
            }}
          >
            {label}
          </button>
        ))}
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
