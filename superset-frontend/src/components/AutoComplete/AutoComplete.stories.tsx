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
import { Meta, StoryObj } from '@storybook/react';
import AutoComplete, {
  AntAutoCompleteProps,
} from 'src/components/AutoComplete';

export default {
  title: 'Components/AutoComplete',
  component: AutoComplete,
  argTypes: {
    style: {
      control: 'object',
      description: 'Custom styles for AutoComplete',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text for AutoComplete',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the AutoComplete',
      defaultValue: false,
    },
    popupMatchSelectWidth: {
      control: 'number',
      description: 'Width of the dropdown',
      defaultValue: 252,
    },
    children: {
      control: 'text',
      description: 'Custom input inside AutoComplete',
    },
    allowClear: {
      control: 'boolean',
      description: 'Show clear button',
      defaultValue: false,
    },
    autoFocus: {
      control: 'boolean',
      description: 'If get focus when component mounted',
      defaultValue: false,
    },
    backfill: {
      control: 'boolean',
      description: 'If backfill selected item the input when using keyboard',
      defaultValue: false,
    },
    childrenInput: {
      control: 'text',
      description: 'Customize input element',
    },
    defaultActiveFirstOption: {
      control: 'boolean',
      description: 'Whether active first option by default',
      defaultValue: true,
    },
    defaultOpen: {
      control: 'boolean',
      description: 'Initial open state of dropdown',
    },
    defaultValue: {
      control: 'text',
      description: 'Initial selected option',
    },
    dropdownRender: {
      control: false,
      description: 'Customize dropdown content',
    },
    popupClassName: {
      control: 'text',
      description: 'The className of dropdown menu',
    },
    filterOption: {
      control: 'boolean',
      description: 'If true, filter options by input',
      defaultValue: true,
    },
    getPopupContainer: {
      control: false,
      description: 'Parent node of the dropdown.',
      defaultValue: () => document.body,
    },
    notFoundContent: {
      control: 'text',
      description: 'Specify content to show when no result matches',
    },
    open: {
      control: 'boolean',
      description: 'Controlled open state of dropdown',
    },
    options: {
      control: 'object',
      description: 'Select options. Will get better perf than JSX definition',
    },
    status: {
      control: 'select',
      options: ['error', 'warning'],
      description: 'Set validation status',
    },
    size: {
      control: 'select',
      options: ['large', 'middle', 'small'],
      description: 'The size of the input box',
    },
    value: {
      control: 'text',
      description: 'Selected option',
    },
    variant: {
      control: 'select',
      options: ['outlined', 'borderless', 'filled'],
      description: 'Variants of input',
      defaultValue: 'outlined',
    },
    virtual: {
      control: 'boolean',
      description: 'Disable virtual scroll when set to false',
      defaultValue: true,
    },
  },
  parameters: {
    docs: {
      description: {
        component: 'AutoComplete component for search functionality.',
      },
    },
  },
} as Meta<typeof AutoComplete>;

const getRandomInt = (max: number, min = 0) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const searchResult = (query: string) =>
  Array.from({ length: getRandomInt(5) }).map((_, idx) => {
    const category = `${query}${idx}`;
    return {
      value: category,
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>
            Found {query} on{' '}
            <a
              href={`https://github.com/apache/superset?q=${query}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {category}
            </a>
          </span>
          <span>{getRandomInt(200, 100)} results</span>
        </div>
      ),
    };
  });

const AutoCompleteWithOptions = (args: AntAutoCompleteProps) => {
  const [options, setOptions] = useState<AntAutoCompleteProps['options']>([]);

  const handleSearch = (value: string) => {
    setOptions(value ? searchResult(value) : []);
  };

  return <AutoComplete {...args} options={options} onSearch={handleSearch} />;
};
type Story = StoryObj<typeof AutoComplete>;

export const AutoCompleteStory: Story = {
  args: {
    style: { width: 300 },
    placeholder: 'Type to search...',
    disabled: false,
    allowClear: true,
    autoFocus: false,
    backfill: false,
    defaultActiveFirstOption: true,
    defaultOpen: false,
    defaultValue: '',
    filterOption: true,
    notFoundContent: 'No results found',
    open: false,
    size: 'middle',
    variant: 'outlined',
    virtual: true,
  },
  render: (args: AntAutoCompleteProps) => (
    <div style={{ margin: '20px' }}>
      <AutoCompleteWithOptions {...args} />
    </div>
  ),
};
