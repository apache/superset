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
import { useState } from 'react';
import { Checkbox } from '.';
import type { CheckboxProps, CheckboxChangeEvent } from './types';

export default {
  title: 'Components/Checkbox',
  component: Checkbox,
  parameters: {
    docs: {
      description: {
        component:
          'Checkbox component that supports both regular and indeterminate states, built on top of Ant Design v5 Checkbox.',
      },
    },
  },
};

export const InteractiveCheckbox = ({
  checked,
  indeterminate,
}: CheckboxProps) => {
  const [, updateArgs] = useArgs();

  const handleChange = () => {
    // Cycle through states: unchecked -> checked -> indeterminate -> unchecked
    if (!checked && !indeterminate) {
      updateArgs({ checked: true, indeterminate: false });
    } else if (checked && !indeterminate) {
      updateArgs({ checked: false, indeterminate: true });
    } else if (!checked && indeterminate) {
      updateArgs({ checked: false, indeterminate: false });
    }
  };

  return (
    <Checkbox
      onChange={handleChange}
      checked={checked}
      indeterminate={indeterminate}
    >
      I'm an interactive checkbox (click to cycle through states)
    </Checkbox>
  );
};

InteractiveCheckbox.args = {
  checked: false,
  indeterminate: false,
};

// All checkbox states including indeterminate
const STATES = [
  {
    id: 'unchecked',
    checked: false,
    indeterminate: false,
    labelText: 'Unchecked checkbox',
  },
  {
    id: 'checked',
    checked: true,
    indeterminate: false,
    labelText: 'Checked checkbox',
  },
  {
    id: 'indeterminate',
    checked: false,
    indeterminate: true,
    labelText: 'Indeterminate checkbox',
  },
];

export const AllCheckboxStates = () =>
  STATES.map(({ id, checked, indeterminate, labelText }) => (
    <div style={{ marginBottom: '16px' }} key={id}>
      <Checkbox
        id={id}
        checked={checked}
        indeterminate={indeterminate}
        onChange={() => {}}
      >
        {labelText}
      </Checkbox>
    </div>
  ));

export const InteractiveIndeterminate = () => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const options = ['Option 1', 'Option 2', 'Option 3'];

  const handleParentChange = (e: CheckboxChangeEvent) => {
    setSelectedOptions(e.target.checked ? [...options] : []);
  };

  const handleChildChange = (option: string) => {
    setSelectedOptions(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option],
    );
  };

  const isIndeterminate =
    selectedOptions.length > 0 && selectedOptions.length < options.length;
  const isAllSelected = selectedOptions.length === options.length;

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <Checkbox
          id="parent-checkbox"
          checked={isAllSelected}
          indeterminate={isIndeterminate}
          onChange={handleParentChange}
        >
          Select All
        </Checkbox>
      </div>
      {options.map(option => (
        <div style={{ marginLeft: '24px', marginBottom: '8px' }} key={option}>
          <Checkbox
            id={`checkbox-${option}`}
            checked={selectedOptions.includes(option)}
            onChange={() => handleChildChange(option)}
          >
            {option}
          </Checkbox>
        </div>
      ))}
      <div style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
        Selected options:{' '}
        {selectedOptions.length ? selectedOptions.join(', ') : 'None'}
        <br />
        Checkbox state:{' '}
        {isAllSelected
          ? 'All selected'
          : isIndeterminate
            ? 'Indeterminate'
            : 'None selected'}
      </div>
    </div>
  );
};

const DISABLED_STATES = [
  {
    id: 'disabled-unchecked',
    checked: false,
    indeterminate: false,
    labelText: 'Disabled unchecked',
  },
  {
    id: 'disabled-checked',
    checked: true,
    indeterminate: false,
    labelText: 'Disabled checked',
  },
  {
    id: 'disabled-indeterminate',
    checked: false,
    indeterminate: true,
    labelText: 'Disabled indeterminate',
  },
];

export const DisabledCheckboxes = () =>
  DISABLED_STATES.map(({ id, checked, indeterminate, labelText }) => (
    <div style={{ marginBottom: '16px' }} key={id}>
      <Checkbox
        id={id}
        checked={checked}
        indeterminate={indeterminate}
        disabled
        onChange={() => {}}
      >
        {labelText}
      </Checkbox>
    </div>
  ));
