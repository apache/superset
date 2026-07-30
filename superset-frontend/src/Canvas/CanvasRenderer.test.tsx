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
} from 'spec/helpers/testing-library';
import { CanvasRenderer } from './CanvasRenderer';
import { CanvasDefinition, CdlQueryContext } from './types';
import type { QueryRunner } from './runtime';
import { QueryResult } from './resolve';

// echarts touches canvas APIs jsdom lacks; the reactive loop under test is the
// query dispatch, not the render, so stub the engine.
jest.mock('echarts/core', () => ({
  use: jest.fn(),
  registerTheme: jest.fn(),
  init: jest.fn(() => ({
    setOption: jest.fn(),
    resize: jest.fn(),
    dispose: jest.fn(),
  })),
}));

const definition: CanvasDefinition = {
  cdlVersion: 2,
  variables: { region: { type: 'string', default: 'APAC', scope: 'query' } },
  tree: {
    id: 'root',
    type: 'Column',
    children: [
      {
        id: 'to-emea',
        type: 'Button',
        props: { children: 'EMEA' },
        on: {
          click: [{ action: 'setVariable', name: 'region', value: 'EMEA' }],
        },
      },
      {
        id: 'chart',
        type: 'Viz',
        renderer: 'echarts',
        data: {
          queryContext: {
            datasetId: 1,
            metrics: ['SUM(sales)'],
            groupby: ['month'],
            filters: [{ col: 'region', op: '==', val: '$region' }],
          },
          encoding: { x: 'month', y: 'SUM(sales)' },
        },
        option: { series: [{ type: 'line' }] },
      },
    ],
  },
};

const regionOf = (qc: CdlQueryContext): unknown =>
  qc.filters?.find(f => f.col === 'region')?.val;

test('a bound query re-runs with the new value when a control changes a variable', async () => {
  const run = jest.fn(
    async (_queryContext: CdlQueryContext): Promise<QueryResult> => ({
      columns: ['month', 'SUM(sales)'],
      records: [{ month: 'Jan', 'SUM(sales)': 1 }],
    }),
  );
  const runner: QueryRunner = { run };

  render(<CanvasRenderer definition={definition} queryRunner={runner} />);

  // Initial fetch resolves $region to its default.
  await waitFor(() => expect(run).toHaveBeenCalled());
  expect(regionOf(run.mock.calls[0][0])).toBe('APAC');

  run.mockClear();
  await userEvent.click(screen.getByText('EMEA'));

  // The variable change re-runs the bound query with the new value.
  await waitFor(() => expect(run).toHaveBeenCalled());
  const lastCall = run.mock.calls[run.mock.calls.length - 1][0];
  expect(regionOf(lastCall)).toBe('EMEA');
});

test('an invalid canvas renders validation errors instead of the tree', () => {
  const broken = {
    ...definition,
    tree: { ...definition.tree, children: [{ id: 'bad', type: 'NotAThing' }] },
  } as CanvasDefinition;

  render(
    <CanvasRenderer definition={broken} queryRunner={{ run: jest.fn() }} />,
  );

  expect(screen.getByTestId('canvas-validation-errors')).toBeInTheDocument();
});
