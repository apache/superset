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
  act,
  render,
  screen,
  sleep,
  userEvent,
} from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/common';
import {
  TableControls,
  ROW_LIMIT_OPTIONS,
} from '../components/DataTableControls';
import { TableControlsProps } from '../types';

const setup = (overrides: Partial<TableControlsProps> = {}) =>
  render(
    <TableControls
      data={[]}
      columnNames={['name']}
      columnTypes={[GenericDataType.String]}
      rowcount={0}
      onInputChange={jest.fn()}
      isLoading={false}
      canDownload
      rowLimit={100}
      rowLimitOptions={ROW_LIMIT_OPTIONS}
      onRowLimitChange={jest.fn()}
      {...overrides}
    />,
    { useRedux: true },
  );

test('shows the row count when the result fills the selected row limit', () => {
  setup({ rowcount: 100, rowLimit: 100 });

  expect(screen.getByTestId('row-count-label')).toHaveTextContent('100 rows');
});

test('warns that the row limit was reached when the result fills it', async () => {
  setup({ rowcount: 100, rowLimit: 100 });

  userEvent.hover(screen.getByTestId('row-count-label'));

  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'The row limit set for the chart was reached',
  );
});

test('does not warn when the result is smaller than the selected row limit', async () => {
  setup({ rowcount: 42, rowLimit: 100 });

  expect(screen.getByTestId('row-count-label')).toHaveTextContent('42 rows');
  userEvent.hover(screen.getByTestId('row-count-label'));

  // Wait past antd's 0.1s mouseEnterDelay so a regression that made the
  // tooltip appear would be caught here instead of racing the delay.
  await act(() => sleep(150));

  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

test("warns when the chart's own row limit truncates below the selected row limit", async () => {
  setup({ rowcount: 250, rowLimit: 1000, effectiveRowLimit: 250 });

  userEvent.hover(screen.getByTestId('row-count-label'));

  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'The row limit set for the chart was reached',
  );
});

test('labels the row limit selector so it is not read as a second row count', () => {
  setup({ rowcount: 100, rowLimit: 100 });

  expect(screen.getByText('Limit')).toBeInTheDocument();
});
