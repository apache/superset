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
import type { Meta, StoryObj } from '@storybook/react';
import { AutoComplete } from '.';
import type { AutoCompleteProps } from './types';

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
    value: {
      control: 'text',
      description: 'Selected option',
      table: {
        type: { summary: 'string' },
      },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the AutoComplete',
      defaultValue: false,
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    popupMatchSelectWidth: {
      control: 'number',
      description: 'Width of the dropdown',
      defaultValue: 252,
    },
    allowClear: {
      control: 'boolean',
      description: 'Show clear button',
      defaultValue: false,
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    autoFocus: {
      control: 'boolean',
      description: 'If get focus when component mounted',
      defaultValue: false,
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    backfill: {
      control: 'boolean',
      description: 'If backfill selected item the input when using keyboard',
      defaultValue: false,
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    popupClassName: {
      control: 'text',
      description: 'The className of dropdown menu',
    },
    filterOption: {
      control: 'boolean',
      description:
        'If true, filters options by input. If a function, filters options using `inputValue` and `option`. Returns true to include the option, false to exclude it.',
      defaultValue: true,
      table: {
        type: { summary: 'boolean | function(inputValue, option)' },
        defaultValue: { summary: 'true' },
      },
    },
    notFoundContent: {
      control: 'text',
      description: 'Specify content to show when no result matches.',
      defaultValue: undefined,
      table: {
        type: { summary: 'ReactNode' },
        defaultValue: { summary: '-' },
      },
    },
    open: {
      control: 'boolean',
      description: 'Controlled open state of dropdown',
      defaultValue: undefined,
      table: {
        type: { summary: 'boolean' },
      },
    },
    status: {
      control: 'select',
      options: [undefined, 'error', 'warning'],
      description: 'Set validation status',
      defaultValue: undefined,
    },
    size: {
      control: 'select',
      options: [undefined, 'large', 'middle', 'small'],
      description: 'The size of the input box',
      defaultValue: undefined,
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
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'true' },
      },
    },
    // reference of additional props
    defaultValue: {
      control: false,
      description: 'Initial selected option from the `options` array.',
      table: {
        type: { summary: 'string' },
      },
    },
    defaultOpen: {
      control: false,
      description: 'Initial open state of dropdown',
      defaultValue: undefined,
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    defaultActiveFirstOption: {
      control: false,
      description: 'Whether active first option by default',
      defaultValue: undefined,
      table: {
        type: { summary: 'boolean' },
        defaultValue: { summary: 'false' },
      },
    },
    popupRender: {
      control: false,
      description:
        'Custom render function for dropdown content. `(menus: ReactNode) => ReactNode`',
      table: {
        type: { summary: '(menus: ReactNode) => ReactNode' },
        defaultValue: { summary: '-' },
      },
    },
    options: {
      control: false,
      description:
        'Select options. Will get better performance than using JSX elements.',
      table: {
        type: { summary: '{ label: string, value: string }[]' },
        defaultValue: { summary: '-' },
      },
    },
    children: {
      control: false,
      description:
        'Can be used in two ways:\n' +
        '1. Customize input element (e.g., `<Input />`, `<TextArea />`).\n' +
        '2. Provide data source for auto-complete (`React.ReactElement<OptionProps>` or an array of such elements).',
      table: {
        type: {
          summary:
            'React.ReactElement<InputProps> | React.ReactElement<OptionProps> | React.ReactElement<OptionProps>[]',
        },
        defaultValue: { summary: '-' },
      },
    },
    getPopupContainer: {
      control: false,
      description:
        'Parent node of the dropdown. Defaults to `body`. If you encounter positioning issues during scrolling, try setting it to the scrollable area and positioning it relative to that.',
      defaultValue: () => document.body,
      table: {
        type: { summary: '(triggerNode) => HTMLElement' },
        defaultValue: { summary: '() => document.body' },
      },
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

const AutoCompleteWithOptions = (args: AutoCompleteProps) => {
  const [options, setOptions] = useState<AutoCompleteProps['options']>([]);

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
  },
  render: (args: AutoCompleteProps) => (
    <div style={{ margin: '20px' }}>
      <AutoCompleteWithOptions {...args} />
    </div>
  ),
};
