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
import { SelectOptionsType, SelectProps } from './types';
import { Select } from '.';

export default {
  title: 'Components/Select',
  component: Select,
  parameters: {
    docs: {
      description: {
        component:
          'A versatile select component supporting single and multi-select modes, search filtering, option creation, and both synchronous and asynchronous data sources.',
      },
    },
  },
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
    label: <div style={{ color: 'red' }}>JSX Label</div>,
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
  options: argOptions,
  ...args
}: SelectProps) => (
  <div style={{ width: DEFAULT_WIDTH }}>
    <Select
      ariaLabel="interactive-select"
      options={argOptions ?? options}
      {...args}
    />
  </div>
);

InteractiveSelect.args = {
  mode: 'single',
  placeholder: 'Select ...',
  showSearch: true,
  allowNewOptions: false,
  allowClear: false,
  allowSelectAll: true,
  disabled: false,
  invertSelection: false,
  oneLine: false,
  maxTagCount: 4,
};

InteractiveSelect.argTypes = {
  mode: {
    control: 'inline-radio',
    options: ['single', 'multiple'],
    description: 'Whether to allow selection of a single option or multiple.',
  },
  placeholder: {
    control: 'text',
    description: 'Placeholder text when no option is selected.',
  },
  showSearch: {
    control: 'boolean',
    description: 'Whether to show a search input for filtering.',
  },
  allowNewOptions: {
    control: 'boolean',
    description:
      'Whether users can create new options by typing a value not in the list.',
  },
  allowClear: {
    control: 'boolean',
    description: 'Whether to show a clear button to reset the selection.',
  },
  allowSelectAll: {
    control: 'boolean',
    description: 'Whether to show a "Select All" option in multiple mode.',
  },
  disabled: {
    control: 'boolean',
    description: 'Whether the select is disabled.',
  },
  invertSelection: {
    control: 'boolean',
    description:
      'Shows a stop icon instead of a checkmark on selected options, indicating deselection on click.',
  },
  oneLine: {
    control: 'boolean',
    description:
      'Forces tags onto one line with overflow count. Requires multiple mode.',
  },
  maxTagCount: {
    control: { type: 'number' },
    description:
      'Maximum number of tags to display in multiple mode before showing an overflow count.',
  },
};

InteractiveSelect.parameters = {
  docs: {
    staticProps: {
      options: [
        {
          label: 'Such an incredibly awesome long long label',
          value: 'long-label-1',
        },
        {
          label: 'Another incredibly awesome long long label',
          value: 'long-label-2',
        },
        { label: 'Option A', value: 'A' },
        { label: 'Option B', value: 'B' },
        { label: 'Option C', value: 'C' },
        { label: 'Option D', value: 'D' },
        { label: 'Option E', value: 'E' },
        { label: 'Option F', value: 'F' },
        { label: 'Option G', value: 'G' },
        { label: 'Option H', value: 'H' },
        { label: 'Option I', value: 'I' },
      ],
    },
    liveExample: `function Demo() {
  return (
    <div style={{ width: 300 }}>
      <Select
        ariaLabel="demo-select"
        options={[
          { label: 'Dashboards', value: 'dashboards' },
          { label: 'Charts', value: 'charts' },
          { label: 'Datasets', value: 'datasets' },
          { label: 'SQL Lab', value: 'sqllab' },
          { label: 'Settings', value: 'settings' },
        ]}
        placeholder="Select ..."
        showSearch
      />
    </div>
  );
}`,
    examples: [
      {
        title: 'Multi Select',
        code: `function MultiSelectDemo() {
  return (
    <div style={{ width: 400 }}>
      <Select
        ariaLabel="multi-select"
        mode="multiple"
        options={[
          { label: 'Dashboards', value: 'dashboards' },
          { label: 'Charts', value: 'charts' },
          { label: 'Datasets', value: 'datasets' },
          { label: 'SQL Lab', value: 'sqllab' },
          { label: 'Settings', value: 'settings' },
        ]}
        placeholder="Select items..."
        allowSelectAll
        maxTagCount={3}
      />
    </div>
  );
}`,
      },
      {
        title: 'Allow New Options',
        code: `function AllowNewDemo() {
  return (
    <div style={{ width: 300 }}>
      <Select
        ariaLabel="allow-new-select"
        mode="multiple"
        options={[
          { label: 'Red', value: 'red' },
          { label: 'Green', value: 'green' },
          { label: 'Blue', value: 'blue' },
        ]}
        placeholder="Type to add tags..."
        allowNewOptions
        showSearch
      />
    </div>
  );
}`,
      },
      {
        title: 'Inverted Selection',
        code: `function InvertedDemo() {
  return (
    <div style={{ width: 400 }}>
      <Select
        ariaLabel="inverted-select"
        mode="multiple"
        options={[
          { label: 'Admin', value: 'admin' },
          { label: 'Editor', value: 'editor' },
          { label: 'Viewer', value: 'viewer' },
          { label: 'Public', value: 'public' },
        ]}
        placeholder="Exclude roles..."
        invertSelection
      />
    </div>
  );
}`,
      },
      {
        title: 'One Line Mode',
        code: `function OneLineDemo() {
  return (
    <div style={{ width: 300 }}>
      <Select
        ariaLabel="oneline-select"
        mode="multiple"
        options={[
          { label: 'Dashboard 1', value: 'd1' },
          { label: 'Dashboard 2', value: 'd2' },
          { label: 'Dashboard 3', value: 'd3' },
          { label: 'Dashboard 4', value: 'd4' },
          { label: 'Dashboard 5', value: 'd5' },
        ]}
        placeholder="Select dashboards..."
        oneLine
      />
    </div>
  );
}`,
      },
    ],
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

AtEveryCorner.parameters = {
  actions: {
    disable: true,
  },
  controls: {
    disable: true,
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

PageScroll.parameters = {
  actions: {
    disable: true,
  },
  controls: {
    disable: true,
  },
};

/**
 * Extended interactive story for Storybook with additional controls
 * (header, optionsCount, generateOptions) that are story-specific utilities.
 */
export const AdvancedPlayground = (
  args: SelectProps & { optionsCount: number },
) => {
  const { optionsCount, ...selectArgs } = args;
  return (
    <div style={{ width: DEFAULT_WIDTH }}>
      <Select
        {...selectArgs}
        options={generateOptions(options, optionsCount)}
      />
    </div>
  );
};

AdvancedPlayground.args = {
  autoFocus: true,
  allowNewOptions: false,
  allowClear: false,
  autoClearSearchValue: false,
  allowSelectAll: true,
  disabled: false,
  invertSelection: false,
  labelInValue: true,
  maxTagCount: 4,
  mode: 'multiple',
  oneLine: false,
  optionsCount: options.length,
  optionFilterProps: ['value', 'label', 'custom'],
  placeholder: 'Select ...',
  showSearch: true,
};

AdvancedPlayground.argTypes = {
  mode: {
    control: { type: 'inline-radio' },
    options: ['single', 'multiple'],
  },
  optionsCount: {
    control: { type: 'number' },
  },
};
