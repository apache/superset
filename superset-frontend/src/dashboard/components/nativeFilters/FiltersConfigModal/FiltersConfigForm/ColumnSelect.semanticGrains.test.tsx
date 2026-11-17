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
import { DatasourceType } from '@superset-ui/core';
import { Form } from '@superset-ui/core/components';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { NativeFiltersForm } from '../types';
import { ColumnSelect } from './ColumnSelect';

const dimensions = [
  { name: 'C.MARKET_SEGMENT', type: 'string', grain: null },
  ...['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'].map(grain => ({
    name: 'L.SHIP_DATE',
    type: 'date32[day]',
    grain,
  })),
  { name: 'O.ORDER_DATE__MONTH', type: 'date32[day]', grain: 'MONTH' },
];

function renderPicker(id: number, mode?: 'multiple') {
  fetchMock.get(`path:/api/v1/semantic_view/${id}/structure`, {
    result: { dimensions, metrics: [] },
  });
  const onChange = jest.fn();
  const onColumnsLoaded = jest.fn();
  function Harness() {
    const [form] = Form.useForm<NativeFiltersForm>();
    return (
      <ColumnSelect
        form={form}
        filterId="grain-probe"
        datasetId={id}
        datasourceType={DatasourceType.SemanticView}
        onChange={onChange}
        onColumnsLoaded={onColumnsLoaded}
        mode={mode}
      />
    );
  }
  render(<Harness />, { useRedux: true });
  return { onChange, onColumnsLoaded };
}

afterEach(() => fetchMock.clearHistory().removeRoutes());

test.each([undefined, 'multiple'] as const)(
  'offers each semantic member once with mode %s and preserves its name',
  async mode => {
    const { onChange, onColumnsLoaded } = renderPicker(mode ? 802 : 801, mode);
    await waitFor(() => expect(onColumnsLoaded).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getAllByTitle('L.SHIP_DATE')).toHaveLength(1);
    expect(onColumnsLoaded).toHaveBeenLastCalledWith(
      ['C.MARKET_SEGMENT', 'L.SHIP_DATE', 'O.ORDER_DATE__MONTH'],
      `${mode ? 802 : 801}__semantic_view`,
    );
    await userEvent.click(screen.getByTitle('L.SHIP_DATE'));
    expect(onChange.mock.calls[0][0]).toEqual(
      mode ? ['L.SHIP_DATE'] : 'L.SHIP_DATE',
    );
  },
);

test('search removes non-matching grain entries after the full list renders', async () => {
  const { onColumnsLoaded } = renderPicker(803);
  await waitFor(() => expect(onColumnsLoaded).toHaveBeenCalled());
  const search = screen.getByRole('combobox');
  await userEvent.click(search);
  expect(screen.getByTitle('C.MARKET_SEGMENT')).toBeInTheDocument();
  await userEvent.type(search, 'MARKET');
  await waitFor(() =>
    expect(screen.queryAllByTitle('L.SHIP_DATE')).toHaveLength(0),
  );
  expect(screen.queryByTitle('O.ORDER_DATE__MONTH')).not.toBeInTheDocument();
  expect(screen.getByTitle('C.MARKET_SEGMENT')).toBeInTheDocument();
  await userEvent.clear(search);
  await userEvent.type(search, 'SHIP');
  await waitFor(() =>
    expect(screen.queryByTitle('C.MARKET_SEGMENT')).not.toBeInTheDocument(),
  );
  expect(screen.getAllByTitle('L.SHIP_DATE')).toHaveLength(1);
});
