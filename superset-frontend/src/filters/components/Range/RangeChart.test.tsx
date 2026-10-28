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
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/common';
import ChartRenderer, {
  type ChartRendererProps,
} from 'src/components/Chart/ChartRenderer';
import { ChartSource } from 'src/types/ChartSource';
import RangeFilterPlugin from './index';

const plugin = new RangeFilterPlugin().configure({ key: 'filter_range' });

beforeAll(() => plugin.register());
afterAll(() => plugin.unregister());

function chartProps(datasource: string): ChartRendererProps {
  return {
    chartId: 17,
    chartStatus: 'success',
    width: 700,
    height: 400,
    vizType: 'filter_range',
    source: ChartSource.Explore,
    formData: {
      viz_type: 'filter_range',
      datasource,
      groupby: ['amount'],
      enableEmptyFilter: false,
      rangeDisplayMode: 'slider',
    },
    filterState: { value: [null, null] },
    queriesResponse: [],
    actions: {
      chartRenderingSucceeded: jest.fn(),
      chartRenderingFailed: jest.fn(),
      logEvent: jest.fn(),
      updateDataMask: jest.fn(),
    },
  };
}

test('standalone semantic range renders manual inputs through the chart wrapper with no query results', async () => {
  const props = chartProps('1__semantic_view');
  render(<ChartRenderer {...props} />, { useRedux: true });
  const inputs = await screen.findAllByRole('spinbutton');
  expect(inputs).toHaveLength(2);
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  expect(
    screen.queryByText('No results were returned for this query'),
  ).not.toBeInTheDocument();
  fireEvent.change(inputs[0], { target: { value: '5' } });
  fireEvent.change(inputs[1], { target: { value: '7' } });
  await waitFor(() =>
    expect(props.actions.updateDataMask).toHaveBeenLastCalledWith(
      17,
      expect.objectContaining({
        extraFormData: expect.objectContaining({
          filters: [
            { col: 'amount', op: '>=', val: 5 },
            { col: 'amount', op: '<=', val: 7 },
          ],
        }),
      }),
    ),
  );
});

test('standalone SQL range keeps its slider when bounds exist', async () => {
  const props = chartProps('1__table');
  render(
    <ChartRenderer
      {...props}
      queriesResponse={
        [
          {
            data: [{ min: 3, max: 10 }],
            colnames: ['min', 'max'],
            coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
            rowcount: 1,
          },
        ] as ChartRendererProps['queriesResponse']
      }
    />,
    { useRedux: true },
  );
  expect(await screen.findAllByRole('slider')).toHaveLength(2);
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
});

test('standalone SQL range keeps its empty-result inputs usable', async () => {
  render(<ChartRenderer {...chartProps('1__table')} />, { useRedux: true });
  expect(await screen.findAllByRole('spinbutton')).toHaveLength(2);
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
});
