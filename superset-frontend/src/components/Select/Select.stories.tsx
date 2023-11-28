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
import React from 'react';
import ControlHeader from 'src/explore/components/ControlHeader';
import { SelectOptionsType, SelectProps } from './types';

import Select from './Select';

export default {
  title: 'Select',
  component: Select,
};

const DEFAULT_WIDTH = 200;

const options: SelectOptionsType = [
  {
    label: 'Such an incredibly awesome long long label',
    value: 'Such an incredibly awesome long long label',
    custom: 'Secret custom prop',
  },
  {
    label: 'Another incredibly awesome long long label',
    value: 'Another incredibly awesome long long label',
  },
  {
    label: 'JSX Label',
    customLabel: <div style={{ color: 'red' }}>JSX Label</div>,
    value: 'JSX Label',
  },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' },
  { label: 'D', value: 'D' },
  { label: 'E', value: 'E' },
  { label: 'F', value: 'F' },
  { label: 'G', value: 'G' },
  { label: 'H', value: 'H' },
  { label: 'I', value: 'I' },
];

const selectPositions = [
  {
    id: 'topLeft',
    style: { top: '0', left: '0' },
  },
  {
    id: 'topRight',
    style: { top: '0', right: '0' },
  },
  {
    id: 'bottomLeft',
    style: { bottom: '0', left: '0' },
  },
  {
    id: 'bottomRight',
    style: { bottom: '0', right: '0' },
  },
];

const ARG_TYPES = {
  options: {
    defaultValue: options,
    description: `It defines the options of the Select.
      The options can be static, an array of options.
      The options can also be async, a promise that returns an array of options.
    `,
  },
  ariaLabel: {
    description: `It adds the aria-label tag for accessibility standards.
      Must be plain English and localized.
    `,
  },
  labelInValue: {
    defaultValue: true,
    table: {
      disable: true,
    },
  },
  name: {
    table: {
      disable: true,
    },
  },
  notFoundContent: {
    table: {
      disable: true,
    },
  },
  mappedMode: {
    table: {
      disable: true,
    },
  },
  mode: {
    description: `It defines whether the Select should allow for
      the selection of multiple options or single. Single by default.
    `,
    defaultValue: 'single',
    control: {
      type: 'inline-radio',
      options: ['single', 'multiple'],
    },
  },
  allowNewOptions: {
    description: `It enables the user to create new options.
      Can be used with standard or async select types.
      Can be used with any mode, single or multiple. False by default.
    `,
  },
  invertSelection: {
    description: `It shows a stop-outlined icon at the far right of a selected
      option instead of the default checkmark.
      Useful to better indicate to the user that by clicking on a selected
      option it will be de-selected. False by default.
    `,
  },
  optionFilterProps: {
    description: `It allows to define which properties of the option object
      should be looked for when searching.
      By default label and value.
    `,
  },
  oneLine: {
    defaultValue: false,
    description: `Sets maxTagCount to 1. The overflow tag is always displayed in
       the same line, line wrapping is disabled.
       When the dropdown is open, sets maxTagCount to 0,
       displays only the overflow tag.
       Requires '"mode=multiple"'.
     `,
  },
  maxTagCount: {
    defaultValue: 4,
    description: `Sets maxTagCount attribute. The overflow tag is displayed in
       place of the remaining items.
       Requires '"mode=multiple"'.
     `,
  },
};

const mountHeader = (type: String) => {
  let header;
  if (type === 'text') {
    header = 'Text header';
  } else if (type === 'control') {
    header = (
      <ControlHeader
        label="Control header"
        warning="Example of warning message"
      />
    );
  }
  return header;
};

const generateOptions = (opts: SelectOptionsType, count: number) => {
  let generated = opts.slice();
  let iteration = 0;
  while (generated.length < count) {
    iteration += 1;
    generated = generated.concat(
      // eslint-disable-next-line no-loop-func
      generated.map(({ label, value }) => ({
        label: `${label} ${iteration}`,
        value: `${value} ${iteration}`,
      })),
    );
  }
  return generated.slice(0, count);
};

export const InteractiveSelect = ({
  header,
  options,
  optionsCount,
  ...args
}: SelectProps & { header: string; optionsCount: number }) => (
  <div
    style={{
      width: DEFAULT_WIDTH,
    }}
  >
    <Select
      {...args}
      options={
        Array.isArray(options)
          ? generateOptions(options, optionsCount)
          : options
      }
      header={mountHeader(header)}
    />
  </div>
);

InteractiveSelect.args = {
  autoFocus: true,
  allowNewOptions: false,
  allowClear: false,
  autoClearSearchValue: false,
  allowSelectAll: true,
  showSearch: true,
  disabled: false,
  invertSelection: false,
  placeholder: 'Select ...',
  optionFilterProps: ['value', 'label', 'custom'],
  oneLine: false,
  maxTagCount: 4,
};

InteractiveSelect.argTypes = {
  ...ARG_TYPES,
  optionsCount: {
    defaultValue: options.length,
    control: {
      type: 'number',
    },
  },
  header: {
    defaultValue: 'none',
    description: `It adds a header on top of the Select. Can be any ReactNode.`,
    control: { type: 'inline-radio', options: ['none', 'text', 'control'] },
  },
  pageSize: {
    description: `It defines how many results should be included in the query response.
      Works in async mode only (See the options property).
    `,
  },
  fetchOnlyOnSearch: {
    description: `It fires a request against the server only after searching.
      Works in async mode only (See the options property).
      Undefined by default.
    `,
  },
};

InteractiveSelect.story = {
  parameters: {
    knobs: {
      disable: true,
    },
  },
};

export const AtEveryCorner = () => (
  <>
    {selectPositions.map(position => (
      <div
        key={position.id}
        style={{
          ...position.style,
          margin: 30,
          width: DEFAULT_WIDTH,
          position: 'absolute',
        }}
      >
        <Select
          ariaLabel={`gallery-${position.id}`}
          options={options}
          labelInValue
        />
      </div>
    ))}
    <p style={{ position: 'absolute', top: '40%', left: '33%', width: 500 }}>
      The objective of this panel is to show how the Select behaves when in
      touch with the viewport extremities. In particular, how the drop-down is
      displayed and if the tooltips of truncated items are correctly positioned.
    </p>
  </>
);

AtEveryCorner.story = {
  parameters: {
    actions: {
      disable: true,
    },
    controls: {
      disable: true,
    },
    knobs: {
      disable: true,
    },
  },
};

export const PageScroll = () => (
  <div style={{ height: 2000, overflowY: 'auto' }}>
    <div
      style={{
        width: DEFAULT_WIDTH,
        position: 'absolute',
        top: 30,
        right: 30,
      }}
    >
      <Select ariaLabel="page-scroll-select-1" options={options} labelInValue />
    </div>
    <div
      style={{
        width: DEFAULT_WIDTH,
        position: 'absolute',
        bottom: 30,
        right: 30,
      }}
    >
      <Select ariaLabel="page-scroll-select-2" options={options} />
    </div>
    <p
      style={{
        position: 'absolute',
        top: '40%',
        left: 30,
        width: 500,
      }}
    >
      The objective of this panel is to show how the Select behaves when there's
      a scroll on the page. In particular, how the drop-down is displayed.
    </p>
  </div>
);

PageScroll.story = {
  parameters: {
    actions: {
      disable: true,
    },
    controls: {
      disable: true,
    },
    knobs: {
      disable: true,
    },
  },
};
