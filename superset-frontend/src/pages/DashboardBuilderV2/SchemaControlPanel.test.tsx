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
import { SupersetClient } from '@superset-ui/core';
import {
  render,
  screen,
  waitFor,
  selectOption,
} from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import 'src/core/dashboard';
import { fetchQueryData } from 'src/core/dashboard/chartData';
import SchemaControlPanel from './SchemaControlPanel';

jest.mock('src/core/dashboard/chartData', () => ({
  fetchQueryData: jest.fn().mockResolvedValue({ columns: [], rows: [] }),
}));

const fetchQueryDataMock = fetchQueryData as jest.MockedFunction<
  typeof fetchQueryData
>;

const provider = DashboardProvider.getInstance();

// A minimal backend schema: one scalar field the generic renderers can draw.
const SCHEMA = {
  type: 'object',
  properties: {
    prefix: { type: 'string', title: 'Prefix' },
  },
};

const postSpy = jest.spyOn(SupersetClient, 'post');

beforeEach(() => {
  provider.reset();
  postSpy.mockReset();
  postSpy.mockResolvedValue({ json: { result: SCHEMA } } as never);
  fetchQueryDataMock.mockReset();
  fetchQueryDataMock.mockResolvedValue({ columns: [], rows: [] });
});

const mount = (type: string, props?: Record<string, unknown>) => {
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type,
    ...(props ? { props } : {}),
  });
  render(<SchemaControlPanel nodeId={id} />);
  return id;
};

test('fetches the backend control schema for the widget type and renders it', async () => {
  mount('metric-tile', { dataBinding: { datasetId: 1, metrics: ['count'] } });

  await waitFor(() =>
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/widgets/type/metric-tile/control-schema',
      }),
    ),
  );
  // The served field is rendered by the generic JSONForms renderers.
  expect(await screen.findByText('Prefix')).toBeInTheDocument();
});

test('posts the current props as control_values so dynamic fields can enrich', async () => {
  mount('metric-tile', { dataBinding: { datasetId: 7, metrics: ['count'] } });

  await waitFor(() => expect(postSpy).toHaveBeenCalled());
  expect(postSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      jsonPayload: expect.objectContaining({
        control_values: expect.objectContaining({
          dataBinding: { datasetId: 7, metrics: ['count'] },
        }),
      }),
    }),
  );
});

test('discovers series from the color dimension (the last dimension by default), not the first', async () => {
  // Grouped by [name, gender]: the widget colors by the last dimension, so the
  // customizable series must be the distinct genders — not the many names.
  fetchQueryDataMock.mockResolvedValue({
    columns: ['name', 'gender', 'count'],
    rows: [
      { name: 'Aaron', gender: 'boy', count: 3 },
      { name: 'Abigail', gender: 'girl', count: 5 },
      { name: 'Adam', gender: 'boy', count: 2 },
    ],
  });

  mount('balloons', {
    dataBinding: {
      datasetId: 1,
      metrics: ['count'],
      dimensions: ['name', 'gender'],
    },
  });

  await waitFor(() =>
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPayload: expect.objectContaining({ series: ['boy', 'girl'] }),
      }),
    ),
  );
});

test('re-enriches a field depending on a plain sibling value, not just series (filter.select: column depends on datasetId)', async () => {
  const schemaBeforeDataset = {
    type: 'object',
    properties: {
      datasetId: {
        type: 'integer',
        title: 'Dataset ID',
        enum: [1],
        'x-enumNames': ['Sales'],
      },
      column: {
        type: 'string',
        title: 'Column',
        'x-dynamic': true,
        'x-dependsOn': ['datasetId'],
        enum: [],
      },
    },
  };
  const schemaAfterDataset = {
    ...schemaBeforeDataset,
    properties: {
      ...schemaBeforeDataset.properties,
      column: {
        ...schemaBeforeDataset.properties.column,
        enum: ['region', 'product_line'],
      },
    },
  };
  postSpy.mockImplementation(
    async (config: { jsonPayload?: unknown }) =>
      ({
        json: {
          result: (
            config.jsonPayload as { control_values?: { datasetId?: number } }
          )?.control_values?.datasetId
            ? schemaAfterDataset
            : schemaBeforeDataset,
        },
      }) as never,
  );

  mount('filter.select', {});

  // Only `datasetId` is a select before any dataset is picked — `column`'s
  // enum is still empty, so it renders as the generic text control.
  await screen.findByText('Dataset ID');
  expect(await screen.findAllByRole('combobox')).toHaveLength(1);

  await selectOption('Sales');

  // Picking the dataset debounces a schema re-fetch carrying `datasetId`
  // along, which comes back with `column`'s enum populated — turning it
  // into a second select, without anything here depending on `series`.
  await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(2), {
    timeout: 3000,
  });
  await waitFor(
    async () => expect(await screen.findAllByRole('combobox')).toHaveLength(2),
    { timeout: 3000 },
  );
});

test('discovers series from an explicit colorDimension when set', async () => {
  fetchQueryDataMock.mockResolvedValue({
    columns: ['name', 'gender', 'count'],
    rows: [
      { name: 'Aaron', gender: 'boy', count: 3 },
      { name: 'Abigail', gender: 'girl', count: 5 },
    ],
  });

  mount('balloons', {
    dataBinding: {
      datasetId: 1,
      metrics: ['count'],
      dimensions: ['name', 'gender'],
    },
    colorDimension: 'name',
  });

  await waitFor(() =>
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonPayload: expect.objectContaining({ series: ['Aaron', 'Abigail'] }),
      }),
    ),
  );
});
