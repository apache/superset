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
import { useState } from 'react';
import PopoverDropdown, { PopoverDropdownProps, OptionProps } from '.';

export default {
  title: 'PopoverDropdown',
  includeStories: ['InteractivePopoverDropdown'],
};

export const OPTIONS: OptionProps[] = [
  { label: 'Option A', value: 'A' },
  { label: 'Option B', value: 'B' },
  { label: 'Option C', value: 'C' },
];

type ElementType = 'default' | 'button';

type Props = PopoverDropdownProps & {
  buttonType: ElementType;
  optionType: ElementType;
};

export const InteractivePopoverDropdown = (props: Props) => {
  const { value, buttonType, optionType, ...rest } = props;
  const [currentValue, setCurrentValue] = useState(value);

  const newElementHandler =
    (type: ElementType) =>
    ({ label, value }: OptionProps) => {
      if (type === 'button') {
        return (
          <button type="button" key={value}>
            {label}
          </button>
        );
      }
      return <span>{label}</span>;
    };

  return (
    <PopoverDropdown
      {...rest}
      value={currentValue}
      renderButton={newElementHandler(buttonType)}
      renderOption={newElementHandler(optionType)}
      onChange={selected => setCurrentValue(selected as string)}
    />
  );
};

InteractivePopoverDropdown.argTypes = {
  buttonType: {
    defaultValue: 'default',
    control: { type: 'radio' },
    options: ['default', 'button'],
  },
  optionType: {
    defaultValue: 'default',
    control: { type: 'radio' },
    options: ['default', 'button'],
  },
  value: {
    defaultValue: OPTIONS[0].value,
    table: { disable: true },
  },
  options: {
    defaultValue: OPTIONS,
    table: { disable: true },
  },
};
