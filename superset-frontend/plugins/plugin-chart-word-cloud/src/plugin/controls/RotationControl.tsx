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
import { t } from '@superset-ui/core';
import { Select, SelectValue } from '@superset-ui/core/components';
import { ControlHeader } from '@superset-ui/chart-controls';
import { ControlComponentProps } from '@superset-ui/chart-controls';

type RotationControlProps = ControlComponentProps<string> & {
  choices?: [string, string][];
  clearable?: boolean;
};

export default function RotationControl({
  name = 'rotation',
  value,
  onChange,
  choices = [
    ['random', t('random')],
    ['flat', t('flat')],
    ['square', t('square')],
  ],
  label = t('Word Rotation'),
  description = t('Rotation to apply to words in the cloud'),
  renderTrigger = true,
  clearable = false,
}: RotationControlProps) {
  return (
    <div className="Control" data-test={name}>
      <ControlHeader
        name={name}
        label={label}
        description={description}
        renderTrigger={renderTrigger}
      />
      <Select
        value={value ?? 'square'}
        options={choices.map(([key, text]) => ({ label: text, value: key }))}
        onChange={(val: SelectValue) => {
          if (val === null || val === undefined) {
            return;
          }
          // Handle LabeledValue object
          if (
            typeof val === 'object' &&
            'value' in val &&
            val.value !== undefined
          ) {
            onChange?.(val.value as string);
          } else if (typeof val === 'string' || typeof val === 'number') {
            // Handle raw value
            onChange?.(String(val));
          }
        }}
        allowClear={clearable}
      />
    </div>
  );
}

RotationControl.displayName = 'RotationControl';
