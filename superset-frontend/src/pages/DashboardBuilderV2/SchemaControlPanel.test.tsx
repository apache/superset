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
  selectOption,
  waitFor,
} from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import 'src/core/dashboard';
import { fetchQueryData } from 'src/core/dashboard/chartData';
import { resetDatasetMetadataCacheForTests } from 'src/core/dashboard/datasetMetadata';
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
const getSpy = jest.spyOn(SupersetClient, 'get');

beforeEach(() => {
  provider.reset();
  postSpy.mockReset();
  postSpy.mockResolvedValue({ json: { result: SCHEMA } } as never);
  getSpy.mockReset();
  fetchQueryDataMock.mockReset();
  fetchQueryDataMock.mockResolvedValue({ columns: [], rows: [] });
  // `useDatasetMetadata` caches by dataset id for the lifetime of the page,
  // which would otherwise leak one test's mocked columns/metrics into the
  // next test that binds the same `datasetId`.
  resetDatasetMetadataCacheForTests();
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

test('renders a column picker for an x-control: "column" field and writes the pick back into props', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          colorDimension: {
            type: 'string',
            title: 'Color dimension',
            'x-control': 'column',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'gender', type_generic: 1 }],
        metrics: [],
      },
    },
  } as never);

  const id = mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
  });

  await screen.findByText('Color dimension');
  await selectOption('gender');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.colorDimension).toBe('gender'),
  );
});

test('renders an ordered column-multi list for an x-control: "column-multi" field, and picking one writes the array back', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          dimensions: {
            type: 'array',
            title: 'Dimensions',
            'x-control': 'column-multi',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [
          { column_name: 'name', type_generic: 1 },
          { column_name: 'gender', type_generic: 1 },
        ],
        metrics: [],
      },
    },
  } as never);

  const id = mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
  });

  await screen.findByText('Dimensions');
  await selectOption('name');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.dimensions).toEqual(['name']),
  );
});

test('renders a metric picker for an x-control: "metric-multi" field and writes the pick back', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            title: 'Metrics',
            'x-control': 'metric-multi',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  const id = mount('balloons', { dataBinding: { datasetId: 1, metrics: [] } });

  await screen.findByText('Metrics');
  await selectOption('Count');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.metrics).toEqual(['count']),
  );
});

test('falls back to the raw JSON editor when an existing metric entry is an ad-hoc aggregate', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            title: 'Metrics',
            'x-control': 'metric-multi',
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  mount('balloons', {
    dataBinding: { datasetId: 1 },
    metrics: [
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'sales' },
        aggregate: 'SUM',
      },
    ],
  });

  expect(await screen.findByText('Metrics')).toBeInTheDocument();
  // The raw JSON editor renders a textarea, not a Select — its absence
  // confirms the fallback fired instead of the picker.
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

test('the real balloons schema shape (dataBinding nested under $defs) renders pickers for dimensions, metrics, and colorDimension', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: {
          dataBinding: { $ref: '#/$defs/DataBinding' },
          colorDimension: {
            type: 'string',
            title: 'Color dimension',
            'x-control': 'column',
          },
        },
        $defs: {
          DataBinding: {
            type: 'object',
            properties: {
              datasetId: { type: 'integer', title: 'Dataset ID' },
              metrics: {
                type: 'array',
                title: 'Metrics',
                'x-control': 'metric-multi',
              },
              dimensions: {
                type: 'array',
                title: 'Dimensions',
                'x-control': 'column-multi',
              },
            },
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'gender', type_generic: 1 }],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  // `metrics`/`dimensions` are pre-filled with the only known metric/column
  // so neither's "Add field" select renders — otherwise `selectOption`
  // would find three comboboxes (dimensions' add-select, metrics'
  // add-select, and colorDimension's) instead of the one it expects.
  const id = mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'], dimensions: ['gender'] },
  });

  await screen.findByText('Color dimension');
  await selectOption('gender');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.colorDimension).toBe('gender'),
  );
});
