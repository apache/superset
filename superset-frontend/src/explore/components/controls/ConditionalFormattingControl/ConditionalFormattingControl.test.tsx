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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { Comparator } from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/common';
import ConditionalFormattingControl from './ConditionalFormattingControl';
import { ConditionalFormattingConfig, FormattingPopoverProps } from './types';

// Stand-in popover: renders its trigger and a button that submits a fixed
// formatter, so tests can add one without driving the full form.
jest.mock('./FormattingPopover', () => ({
  FormattingPopover: ({
    children,
    onChange,
    title,
  }: Pick<FormattingPopoverProps, 'children' | 'onChange' | 'title'>) => (
    <div>
      {children}
      <button
        type="button"
        onClick={() =>
          onChange({
            column: 'my_col',
            operator: jest.requireActual<
              typeof import('@superset-ui/chart-controls')
            >('@superset-ui/chart-controls').Comparator.IsTrue,
            colorScheme: 'colorSuccess',
          })
        }
      >
        {`submit ${title}`}
      </button>
    </div>
  ),
}));

const columnOptions = [
  { label: 'My Column', value: 'my_col', dataType: GenericDataType.Boolean },
];

const defaultProps = {
  columnOptions,
  verboseMap: {} as Record<string, string>,
  removeIrrelevantConditions: false,
  label: 'Conditional Formatting',
  description: 'Test',
  name: 'conditional_formatting',
  onChange: jest.fn(),
};

test('renders "is false" operator label without trailing undefined', () => {
  const value: ConditionalFormattingConfig[] = [
    {
      column: 'my_col',
      operator: Comparator.IsFalse,
      colorScheme: 'colorSuccess',
    },
  ];
  render(<ConditionalFormattingControl {...defaultProps} value={value} />);
  expect(screen.getByText('my_col is false')).toBeInTheDocument();
});

test('renders "is true" operator label without trailing undefined', () => {
  const value: ConditionalFormattingConfig[] = [
    {
      column: 'my_col',
      operator: Comparator.IsTrue,
      colorScheme: 'colorSuccess',
    },
  ];
  render(<ConditionalFormattingControl {...defaultProps} value={value} />);
  expect(screen.getByText('my_col is true')).toBeInTheDocument();
});

test('renders "is null" operator label without trailing undefined', () => {
  const value: ConditionalFormattingConfig[] = [
    {
      column: 'my_col',
      operator: Comparator.IsNull,
      colorScheme: 'colorSuccess',
    },
  ];
  render(<ConditionalFormattingControl {...defaultProps} value={value} />);
  expect(screen.getByText('my_col is null')).toBeInTheDocument();
});

test('renders "is not null" operator label without trailing undefined', () => {
  const value: ConditionalFormattingConfig[] = [
    {
      column: 'my_col',
      operator: Comparator.IsNotNull,
      colorScheme: 'colorSuccess',
    },
  ];
  render(<ConditionalFormattingControl {...defaultProps} value={value} />);
  expect(screen.getByText('my_col is not null')).toBeInTheDocument();
});

test('renders verbose column name when available', () => {
  const value: ConditionalFormattingConfig[] = [
    {
      column: 'my_col',
      operator: Comparator.IsFalse,
      colorScheme: 'colorSuccess',
    },
  ];
  render(
    <ConditionalFormattingControl
      {...defaultProps}
      verboseMap={{ my_col: 'My Column' }}
      value={value}
    />,
  );
  expect(screen.getByText('My Column is false')).toBeInTheDocument();
});

// Writing [] for a chart with no formatters made version history record a
// "Set 'conditional formatting'" change the user never made (sc-126894).
test('leaves an unset value unset when nothing is configured', () => {
  const onChange = jest.fn();
  render(
    <ConditionalFormattingControl {...defaultProps} onChange={onChange} />,
  );
  expect(screen.getByText('Add new color formatter')).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test('keeps an explicitly empty value working', () => {
  const onChange = jest.fn();
  render(
    <ConditionalFormattingControl
      {...defaultProps}
      onChange={onChange}
      value={[]}
    />,
  );
  expect(screen.getByText('Add new color formatter')).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test('does not overwrite a value supplied after mount', () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <ConditionalFormattingControl {...defaultProps} onChange={onChange} />,
  );
  // E.g. an in-place version restore hydrating formatters into the panel.
  rerender(
    <ConditionalFormattingControl
      {...defaultProps}
      onChange={onChange}
      value={[
        {
          column: 'my_col',
          operator: Comparator.IsTrue,
          colorScheme: 'colorSuccess',
        },
      ]}
    />,
  );
  expect(onChange).not.toHaveBeenCalled();
});

test('reports the removal of the last formatter', async () => {
  const onChange = jest.fn();
  const value: ConditionalFormattingConfig[] = [
    {
      column: 'my_col',
      operator: Comparator.IsTrue,
      colorScheme: 'colorSuccess',
    },
  ];
  render(
    <ConditionalFormattingControl
      {...defaultProps}
      onChange={onChange}
      value={value}
    />,
  );
  await userEvent.click(screen.getByLabelText('close'));
  expect(screen.queryByText('my_col is true')).not.toBeInTheDocument();
  expect(onChange).toHaveBeenLastCalledWith([]);
});

test('reports adding and then removing a formatter on an unset value', async () => {
  const onChange = jest.fn();
  render(
    <ConditionalFormattingControl {...defaultProps} onChange={onChange} />,
  );
  await userEvent.click(screen.getByText('submit Add new formatter'));
  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({ column: 'my_col' }),
  ]);
  await userEvent.click(screen.getByLabelText('close'));
  expect(onChange).toHaveBeenLastCalledWith([]);
});
