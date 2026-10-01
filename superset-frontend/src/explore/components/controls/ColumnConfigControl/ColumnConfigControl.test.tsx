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
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/common';
import ColumnConfigControl from './ColumnConfigControl';

type ControlProps = Parameters<typeof ColumnConfigControl>[0];

const makeColumns = (count: number) => {
  const colnames = Array.from({ length: count }, (_, i) => `col_${i + 1}`);
  return {
    colnames,
    coltypes: colnames.map(() => GenericDataType.String),
  };
};

const renderControl = (props: Partial<ControlProps> = {}) => {
  const onChange = jest.fn();
  const utils = render(
    <ColumnConfigControl
      name="column_config"
      label="Customize columns"
      columnsPropsObject={makeColumns(3)}
      value={{}}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange, ...utils };
};

// The checkbox control renders its label in the header next to the input
// without associating them, so resolve the input through the header.
const findCheckbox = async (label: string) => {
  const header = (await screen.findByText(label)).closest(
    '.ControlHeader',
  ) as HTMLElement;
  return within(header).getByRole('checkbox');
};

const openColumn = async (name: string) => {
  await userEvent.click(screen.getByText(name));
  return findCheckbox('Truncate Cells');
};

test('renders one row per column when no columns are applied', () => {
  renderControl();
  expect(screen.getByText('col_1')).toBeInTheDocument();
  expect(screen.getByText('col_2')).toBeInTheDocument();
  expect(screen.getByText('col_3')).toBeInTheDocument();
});

test('renders only the rows listed in appliedColumnNames', () => {
  renderControl({ appliedColumnNames: ['col_1', 'col_3'] });
  expect(screen.getByText('col_1')).toBeInTheDocument();
  expect(screen.queryByText('col_2')).not.toBeInTheDocument();
  expect(screen.getByText('col_3')).toBeInTheDocument();
});

test('renders nothing when there are no columns', () => {
  const { container } = renderControl({
    columnsPropsObject: { colnames: [], coltypes: [] },
  });
  expect(container).toBeEmptyDOMElement();
});

test('does not offer to show more columns at the 12 column limit', () => {
  renderControl({ columnsPropsObject: makeColumns(12) });
  expect(screen.getByText('col_12')).toBeInTheDocument();
  expect(screen.queryByText('Show all columns')).not.toBeInTheDocument();
});

test('truncates to 10 rows and offers to show all columns above 12', () => {
  renderControl({ columnsPropsObject: makeColumns(13) });
  expect(screen.getByText('col_10')).toBeInTheDocument();
  expect(screen.queryByText('col_11')).not.toBeInTheDocument();
  expect(screen.getByText('Show all columns')).toBeInTheDocument();
});

test('expands and collapses the full column list via the toggle', async () => {
  renderControl({ columnsPropsObject: makeColumns(13) });

  await userEvent.click(screen.getByText('Show all columns'));
  expect(screen.getByText('col_13')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Show less columns'));
  expect(screen.queryByText('col_13')).not.toBeInTheDocument();
  expect(screen.getByText('Show all columns')).toBeInTheDocument();
});

test('counts only applied columns toward the show more threshold', () => {
  renderControl({
    columnsPropsObject: makeColumns(20),
    appliedColumnNames: ['col_1', 'col_2'],
  });
  expect(screen.queryByText('Show all columns')).not.toBeInTheDocument();
});

test('opens the popover with the column config form on click', async () => {
  renderControl();
  expect(screen.queryByText('Truncate Cells')).not.toBeInTheDocument();
  expect(await openColumn('col_2')).toBeInTheDocument();
});

test('shows the stored config for the column in the popover', async () => {
  renderControl({ value: { col_2: { truncateLongCells: true } } });
  expect(await openColumn('col_2')).toBeChecked();
});

test('calls onChange after the debounce with the edited column config', async () => {
  const { onChange } = renderControl();
  const checkbox = await openColumn('col_2');

  await userEvent.click(checkbox);
  expect(onChange).not.toHaveBeenCalled();

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({
      col_2: { truncateLongCells: true },
    }),
  );
});

test('merges the edit into existing configs of other known columns', async () => {
  const { onChange } = renderControl({
    value: { col_1: { columnWidth: 50 } },
  });
  await userEvent.click(await openColumn('col_2'));

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({
      col_1: { columnWidth: 50 },
      col_2: { truncateLongCells: true },
    }),
  );
});

test('keeps existing keys of the edited column alongside the new one', async () => {
  const { onChange } = renderControl({
    value: { col_2: { columnWidth: 80 } },
  });
  await userEvent.click(await openColumn('col_2'));

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({
      col_2: { columnWidth: 80, truncateLongCells: true },
    }),
  );
});

test('drops stored configs for columns that are no longer known', async () => {
  const { onChange } = renderControl({
    value: {
      col_1: { columnWidth: 50 },
      removed_col: { columnWidth: 99 },
    },
  });
  await userEvent.click(await openColumn('col_2'));

  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const saved = onChange.mock.calls[0][0];
  expect(saved).not.toHaveProperty('removed_col');
  expect(saved).toHaveProperty('col_1', { columnWidth: 50 });
});

test('drops configs of columns hidden by appliedColumnNames on edit', async () => {
  const { onChange } = renderControl({
    appliedColumnNames: ['col_1', 'col_2'],
    value: { col_3: { columnWidth: 30 } },
  });
  await userEvent.click(await openColumn('col_1'));

  await waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange.mock.calls[0][0]).toEqual({
    col_1: { truncateLongCells: true },
  });
});

const timeComparisonProps = (
  timeComparisonColumnMap: Record<string, boolean>,
): Partial<ControlProps> => ({
  columnsPropsObject: {
    colnames: ['metric_a', 'metric_b'],
    coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
    timeComparisonColumnMap,
  },
});

test('adds a General tab for time comparison columns', async () => {
  renderControl(timeComparisonProps({ metric_a: true }));
  await userEvent.click(screen.getByText('metric_a'));

  const tabs = await screen.findAllByRole('tab');
  expect(tabs.map(tab => tab.textContent)).toEqual([
    'General',
    'Column Settings',
    'Number formatting',
  ]);
  expect(await findCheckbox('Display column in the chart')).toBeInTheDocument();
});

test('omits the General tab for columns that are not time comparison columns', async () => {
  renderControl(timeComparisonProps({ metric_a: true }));
  await userEvent.click(screen.getByText('metric_b'));

  const tabs = await screen.findAllByRole('tab');
  expect(tabs.map(tab => tab.textContent)).toEqual([
    'Column Settings',
    'Number formatting',
  ]);
});

test('saves General tab edits under the time comparison column name', async () => {
  const { onChange } = renderControl(timeComparisonProps({ metric_a: true }));
  await userEvent.click(screen.getByText('metric_a'));
  await userEvent.click(await findCheckbox('Display column in the chart'));

  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({ metric_a: { visible: false } }),
  );
});

test('shows a hidden-column icon on child columns configured as not visible', () => {
  renderControl({
    columnsPropsObject: {
      ...makeColumns(2),
      childColumnMap: { col_2: true },
    },
    value: { col_1: { visible: false }, col_2: { visible: false } },
  });
  // col_1 is hidden too but is not a child column, so only col_2 shows the icon.
  expect(screen.getAllByRole('img', { name: 'eye-invisible' })).toHaveLength(1);
});

// The time column is reported as `__timestamp` by the query but displayed as
// "Time". The table plugins look a column's config up by the raw query
// column name.
const timestampProps = (
  value: ControlProps['value'] = {},
): Partial<ControlProps> => ({
  columnsPropsObject: {
    colnames: ['__timestamp', 'name'],
    coltypes: [GenericDataType.Temporal, GenericDataType.String],
  },
  value,
});

test('labels the __timestamp column with its alias', () => {
  renderControl(timestampProps());
  expect(screen.getByText('Time')).toBeInTheDocument();
  expect(screen.queryByText('__timestamp')).not.toBeInTheDocument();
});

test('does not alias columns without an alias entry', () => {
  renderControl(timestampProps());
  expect(screen.getByText('name')).toBeInTheDocument();
});

test('reads the stored config of an aliased column by its raw column name', async () => {
  renderControl(timestampProps({ __timestamp: { horizontalAlign: 'right' } }));
  await userEvent.click(screen.getByText('Time'));
  const right = await screen.findByRole('radio', { name: /align-right/ });
  expect(right).toBeChecked();
});

test('does not read back a config stored under the alias', async () => {
  renderControl(timestampProps({ Time: { horizontalAlign: 'right' } }));
  await userEvent.click(screen.getByText('Time'));
  const left = await screen.findByRole('radio', { name: /align-left/ });
  expect(left).toBeChecked();
});
