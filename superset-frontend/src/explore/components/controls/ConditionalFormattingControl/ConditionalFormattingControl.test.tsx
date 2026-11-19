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
import { ComponentProps } from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { Comparator } from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/common';
import ConditionalFormattingControl from './ConditionalFormattingControl';
import { ConditionalFormattingConfig } from './types';

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

const numericColumns = [
  { label: 'Column A', value: 'col_a', dataType: GenericDataType.Numeric },
  { label: 'Column B', value: 'col_b', dataType: GenericDataType.Numeric },
];

const greaterThanA: ConditionalFormattingConfig = {
  column: 'col_a',
  operator: Comparator.GreaterThan,
  targetValue: 1,
  colorScheme: 'colorSuccess',
};

const lessThanB: ConditionalFormattingConfig = {
  column: 'col_b',
  operator: Comparator.LessThan,
  targetValue: 2,
  colorScheme: 'colorSuccess',
};

const renderCrud = (
  props: Partial<ComponentProps<typeof ConditionalFormattingControl>> = {},
) => {
  const onChange = jest.fn();
  const utils = render(
    <ConditionalFormattingControl
      {...defaultProps}
      columnOptions={numericColumns}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...utils };
};

const lastChange = (onChange: jest.Mock) => onChange.mock.calls.at(-1)?.[0];

// Opens the edit popover of the formatter with the given label, sets its
// target value, and applies.
const editTargetValue = async (formatterLabel: string, value: string) => {
  await userEvent.click(screen.getByText(formatterLabel));
  await screen.findByText('Edit formatter');
  const targetValue = screen.getByLabelText('Target value');
  await userEvent.clear(targetValue);
  await userEvent.type(targetValue, value);
  await userEvent.click(screen.getByText('Apply'));
};

// The popover Selects portal their dropdown to <body>, and antd keeps a
// hidden node around for every dropdown that has been closed, so scope the
// option lookup to the dropdown that is actually open rather than to the
// trigger's parent or to the first list in the document.
const pickColumn = async (optionLabel: string) => {
  const trigger = await screen.findByRole('combobox', {
    name: 'Select column',
  });
  await userEvent.click(trigger);
  const dropdown = await waitFor(() => {
    const open = Array.from(
      document.querySelectorAll<HTMLElement>('.ant-select-dropdown'),
    ).filter(el => !el.classList.contains('ant-select-dropdown-hidden'));
    expect(open.length).toBeGreaterThan(0);
    return open[open.length - 1];
  });
  await userEvent.click(await within(dropdown).findByText(optionLabel));
};

test('opens the add formatter popover from the add label', async () => {
  renderCrud();
  expect(screen.queryByText('Add new formatter')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('Add new color formatter'));

  expect(await screen.findByText('Add new formatter')).toBeInTheDocument();
  expect(screen.getByText('Apply')).toBeInTheDocument();
});

test('adds a formatter and reports it through onChange when the popover is applied', async () => {
  const { onChange } = renderCrud();

  await userEvent.click(screen.getByText('Add new color formatter'));
  await pickColumn('Column B');
  await userEvent.click(await screen.findByText('Apply'));

  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      expect.objectContaining({ column: 'col_b' }),
    ]),
  );
  expect(screen.getByText('col_b')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.queryByText('Add new formatter')).not.toBeInTheDocument(),
  );
});

test('appends a new formatter after the existing ones', async () => {
  const { onChange } = renderCrud({ value: [greaterThanA] });

  await userEvent.click(screen.getByText('Add new color formatter'));
  await pickColumn('Column B');
  await userEvent.click(await screen.findByText('Apply'));

  await waitFor(() => expect(lastChange(onChange)).toHaveLength(2));
  expect(lastChange(onChange)[0]).toEqual(greaterThanA);
  expect(lastChange(onChange)[1]).toEqual(
    expect.objectContaining({ column: 'col_b' }),
  );
});

test('opens the edit popover prefilled from the clicked formatter', async () => {
  renderCrud({ value: [greaterThanA, lessThanB] });

  await userEvent.click(screen.getByText('col_b < 2'));

  expect(await screen.findByText('Edit formatter')).toBeInTheDocument();
  expect(screen.getByLabelText('Target value')).toHaveValue('2');
});

test('replaces the edited formatter at its index and keeps the others', async () => {
  const { onChange } = renderCrud({ value: [greaterThanA, lessThanB] });

  await editTargetValue('col_b < 2', '7');

  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      greaterThanA,
      expect.objectContaining({
        column: 'col_b',
        operator: Comparator.LessThan,
        targetValue: 7,
      }),
    ]),
  );
  expect(screen.getByText('col_b < 7')).toBeInTheDocument();
  expect(screen.queryByText('col_b < 2')).not.toBeInTheDocument();
});

test('edits the first formatter without touching later ones', async () => {
  const { onChange } = renderCrud({ value: [greaterThanA, lessThanB] });

  await editTargetValue('col_a > 1', '9');

  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      expect.objectContaining({ column: 'col_a', targetValue: 9 }),
      lessThanB,
    ]),
  );
});

test('deletes a formatter with its close button', async () => {
  const { onChange } = renderCrud({ value: [greaterThanA, lessThanB] });

  const closeButtons = screen.getAllByRole('button', { name: /close/i });
  expect(closeButtons).toHaveLength(2);
  await userEvent.click(closeButtons[0]);

  await waitFor(() => expect(lastChange(onChange)).toEqual([lessThanB]));
  expect(screen.queryByText('col_a > 1')).not.toBeInTheDocument();
  expect(screen.getByText('col_b < 2')).toBeInTheDocument();
});

test('edits the remaining formatter at its new index after an earlier one is deleted', async () => {
  const { onChange } = renderCrud({ value: [greaterThanA, lessThanB] });

  await userEvent.click(screen.getAllByRole('button', { name: /close/i })[0]);
  await waitFor(() => expect(lastChange(onChange)).toEqual([lessThanB]));
  await editTargetValue('col_b < 2', '8');

  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      expect.objectContaining({ column: 'col_b', targetValue: 8 }),
    ]),
  );
  expect(screen.queryByText('col_a > 1')).not.toBeInTheDocument();
  expect(screen.getByText('col_b < 8')).toBeInTheDocument();
});

test('keeps both edits when two formatters are edited one after the other', async () => {
  const { onChange } = renderCrud({ value: [greaterThanA, lessThanB] });

  await editTargetValue('col_a > 1', '5');
  await waitFor(() =>
    expect(screen.queryByText('Edit formatter')).not.toBeInTheDocument(),
  );

  await editTargetValue('col_b < 2', '6');

  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      expect.objectContaining({ column: 'col_a', targetValue: 5 }),
      expect.objectContaining({ column: 'col_b', targetValue: 6 }),
    ]),
  );
});

test('deleting the only formatter reports an empty list', async () => {
  const { onChange } = renderCrud({ value: [greaterThanA] });

  await userEvent.click(screen.getByRole('button', { name: /close/i }));

  await waitFor(() => expect(lastChange(onChange)).toEqual([]));
});

test('prunes formatters whose column is not among the column options', async () => {
  const { onChange } = renderCrud({
    value: [greaterThanA, lessThanB],
    columnOptions: [numericColumns[1]],
    removeIrrelevantConditions: true,
  });

  await waitFor(() => expect(lastChange(onChange)).toEqual([lessThanB]));
  expect(screen.queryByText('col_a > 1')).not.toBeInTheDocument();
  expect(screen.getByText('col_b < 2')).toBeInTheDocument();
});

test('prunes a formatter once its column leaves the column options', async () => {
  const { onChange, rerender } = renderCrud({
    value: [greaterThanA, lessThanB],
    removeIrrelevantConditions: true,
  });
  expect(onChange).not.toHaveBeenCalled();

  rerender(
    <ConditionalFormattingControl
      {...defaultProps}
      columnOptions={[numericColumns[0]]}
      onChange={onChange}
      value={[greaterThanA, lessThanB]}
      removeIrrelevantConditions
    />,
  );

  await waitFor(() => expect(lastChange(onChange)).toEqual([greaterThanA]));
  expect(screen.queryByText('col_b < 2')).not.toBeInTheDocument();
});

test('keeps formatters for missing columns when pruning is disabled', async () => {
  const { onChange } = renderCrud({
    value: [greaterThanA, lessThanB],
    columnOptions: [numericColumns[1]],
    removeIrrelevantConditions: false,
  });

  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText('col_a > 1')).toBeInTheDocument();
  expect(screen.getByText('col_b < 2')).toBeInTheDocument();
});

// Writing [] for a chart with no formatters made version history record a
// "Set 'conditional formatting'" change the user never made.
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
  const { onChange } = renderCrud();
  await userEvent.click(screen.getByText('Add new color formatter'));
  await pickColumn('Column B');
  await userEvent.click(await screen.findByText('Apply'));
  await waitFor(() =>
    expect(lastChange(onChange)).toEqual([
      expect.objectContaining({ column: 'col_b' }),
    ]),
  );
  await userEvent.click(screen.getByLabelText('close'));
  expect(lastChange(onChange)).toEqual([]);
});
