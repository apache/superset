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
import React, { ReactNode } from 'react';
import { JsonValue, useTheme } from '@superset-ui/core';
import ControlHeader from '../../components/ControlHeader';

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
    >
      <ControlHeader {...props} />
      <div className="btn-group btn-group-sm">
        {options.map(([val, label]) => (
          <button
            key={JSON.stringify(val)}
            type="button"
            className={`btn btn-default ${
              val === currentValue ? 'active' : ''
            }`}
            onClick={() => {
              onChange(val);
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
