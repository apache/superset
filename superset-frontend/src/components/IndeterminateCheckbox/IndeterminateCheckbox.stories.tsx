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
import { useArgs } from '@storybook/preview-api';
import IndeterminateCheckbox, { IndeterminateCheckboxProps } from '.';
import { useState } from 'react';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';

export default {
  title: 'IndeterminateCheckbox',
  component: IndeterminateCheckbox,
  parameters: {
    docs: {
      description: {
        component: 'A checkbox component that supports an indeterminate state, built on top of Ant Design v5 Checkbox.',
      },
    },
  },
};

const STATES = [
  { id: 'unchecked', checked: false, indeterminate: false, labelText: 'Unchecked checkbox' },
  { id: 'checked', checked: true, indeterminate: false, labelText: 'Checked checkbox' },
  { id: 'indeterminate', checked: false, indeterminate: true, labelText: 'Indeterminate checkbox' },
];

export const BasicCheckboxStates = () =>
  STATES.map(({ id, ...props }) => (
    <div style={{ marginBottom: '16px' }} key={id}>
      <IndeterminateCheckbox id={id} {...props} onChange={() => {}} />
    </div>
  ));

export const Interactive = () => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const options = ['Option 1', 'Option 2', 'Option 3'];

  const handleParentChange = (e: CheckboxChangeEvent) => {
    setSelectedOptions(e.target.checked ? [...options] : []);
  };

  const handleChildChange = (option: string) => {
    setSelectedOptions(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const isIndeterminate = selectedOptions.length > 0 && selectedOptions.length < options.length;
  const isAllSelected = selectedOptions.length === options.length;

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <IndeterminateCheckbox
          id="parent-checkbox"
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={handleParentChange}
          labelText="Select All"
        />
      </div>
      {options.map(option => (
        <div style={{ marginLeft: '24px', marginBottom: '8px' }} key={option}>
          <IndeterminateCheckbox
            id={`checkbox-${option}`}
            checked={selectedOptions.includes(option)}
            onChange={() => handleChildChange(option)}
            labelText={option}
          />
        </div>
      ))}
    </div>
  );
};

const DISABLED_STATES = [
  { id: 'disabled-unchecked', checked: false, indeterminate: false, labelText: 'Disabled unchecked' },
  { id: 'disabled-checked', checked: true, indeterminate: false, labelText: 'Disabled checked' },
  { id: 'disabled-indeterminate', checked: false, indeterminate: true, labelText: 'Disabled indeterminate' },
];

export const DisabledCheckboxes = () =>
  DISABLED_STATES.map(({ id, ...props }) => (
    <div style={{ marginBottom: '16px' }} key={id}>
      <IndeterminateCheckbox id={id} {...props} disabled onChange={() => {}} />
    </div>
  ));
