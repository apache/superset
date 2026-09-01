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
  selectOption,
  userEvent,
} from 'spec/helpers/testing-library';
import AdhocMetricEditor from './AdhocMetricEditor';

// The real editor (`SQLEditorWithValidation`) hosts a code-editor extension
// point that isn't simulate-able through RTL interactions (see that
// component's own test file, whose "calls onChange" test never actually
// fires one) — stood in with a plain textbox that calls the same `onChange`
// contract, so the SQL tab's round-trip through `toPlainMetric` is still
// exercised end to end.
jest.mock('src/components/SQLEditorWithValidation', () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (next: string) => void;
  }) => (
    <textarea
      aria-label="SQL Expression"
      value={value}
      onChange={event => onChange(event.target.value)}
    />
  ),
}));

const COLUMNS = [{ name: 'sales', verboseName: 'Sales', type: 0 }];

const renderEditor = (
  value: Parameters<typeof AdhocMetricEditor>[0]['value'],
  onSave = jest.fn(),
) => {
  render(
    <AdhocMetricEditor
      value={value}
      columns={COLUMNS}
      datasourceId={1}
      datasourceType="table"
      open
      onOpenChange={jest.fn()}
      onSave={onSave}
    >
      <span>trigger</span>
    </AdhocMetricEditor>,
  );
  return onSave;
};

test('a blank draft cannot be saved until a column and an aggregate are both picked', async () => {
  renderEditor(undefined);

  const save = screen.getByTestId('adhoc-metric-editor-save');
  expect(save).toBeDisabled();

  await selectOption('Sales', 'Column');
  expect(save).toBeDisabled();

  await selectOption('SUM', 'Aggregate');
  expect(save).toBeEnabled();
});

test('the Simple tab round-trips a column/aggregate pick through toPlainMetric', async () => {
  const onSave = renderEditor(undefined);

  await selectOption('Sales', 'Column');
  await selectOption('SUM', 'Aggregate');
  await userEvent.click(screen.getByTestId('adhoc-metric-editor-save'));

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      expressionType: 'SIMPLE',
      column: expect.objectContaining({ column_name: 'sales' }),
      aggregate: 'SUM',
    }),
  );
  // The SQL-only field has no place in a SIMPLE metric's stored shape.
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('sqlExpression');
});

test('an existing SIMPLE metric seeds the Simple tab, not Custom SQL', () => {
  renderEditor({
    expressionType: 'SIMPLE',
    column: { column_name: 'sales', verbose_name: 'Sales' },
    aggregate: 'SUM',
  } as never);

  expect(screen.getByRole('tab', { name: 'Simple' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the Custom SQL tab cannot be saved until an expression is entered, and round-trips it through toPlainMetric', async () => {
  const onSave = renderEditor(undefined);

  await userEvent.click(screen.getByRole('tab', { name: 'Custom SQL' }));
  const save = screen.getByTestId('adhoc-metric-editor-save');
  expect(save).toBeDisabled();

  await userEvent.type(
    screen.getByRole('textbox', { name: 'SQL Expression' }),
    'SUM(sales)',
  );
  expect(save).toBeEnabled();

  await userEvent.click(save);

  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({
      expressionType: 'SQL',
      sqlExpression: 'SUM(sales)',
    }),
  );
  // The SIMPLE-only fields have no place in a SQL metric's stored shape.
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('column');
  expect(onSave.mock.calls[0][0]).not.toHaveProperty('aggregate');
});

test('an existing SQL metric seeds the Custom SQL tab with its expression', () => {
  renderEditor({
    expressionType: 'SQL',
    sqlExpression: 'AVG(sales)',
  } as never);

  expect(screen.getByRole('tab', { name: 'Custom SQL' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByRole('textbox', { name: 'SQL Expression' })).toHaveValue(
    'AVG(sales)',
  );
});

test('Cancel discards the draft without calling onSave', async () => {
  const onOpenChange = jest.fn();
  const onSave = jest.fn();
  render(
    <AdhocMetricEditor
      value={undefined}
      columns={COLUMNS}
      datasourceId={1}
      datasourceType="table"
      open
      onOpenChange={onOpenChange}
      onSave={onSave}
    >
      <span>trigger</span>
    </AdhocMetricEditor>,
  );

  await selectOption('Sales', 'Column');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onSave).not.toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
