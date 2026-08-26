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
import type { dashboard as dashboardApi } from '@apache-superset/core';
import {
  render,
  screen,
  selectOption,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import 'src/core/dashboard';
import { fetchQueryData } from 'src/core/dashboard/chartData';
import { resetDatasetMetadataCacheForTests } from 'src/core/dashboard/datasetMetadata';
import { loadDatasetOptions } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect';
import SchemaControlPanel from './SchemaControlPanel';

type DataBindingSpec = dashboardApi.DataBindingSpec;

jest.mock('src/core/dashboard/chartData', () => ({
  fetchQueryData: jest.fn().mockResolvedValue({ columns: [], rows: [] }),
}));

// `loadDatasetOptions` reaches `SupersetClient.get` through `cachedSupersetGet`,
// which binds the client's `get` method once at module load — before this
// file's own `jest.spyOn(SupersetClient, 'get')` below ever runs — so `getSpy`
// can never observe or mock this particular call path. Mocking the exported
// function directly is the same approach this file already takes for
// `fetchQueryData` just above, though that one is mocked to keep `postSpy`
// free for the control-schema endpoint and to vary rows per test, not
// because of this same binding gap.
jest.mock(
  'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect',
  () => ({
    ...jest.requireActual(
      'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DatasetSelect',
    ),
    loadDatasetOptions: jest.fn(),
  }),
);

const fetchQueryDataMock = fetchQueryData as jest.MockedFunction<
  typeof fetchQueryData
>;
const loadDatasetOptionsMock = loadDatasetOptions as jest.MockedFunction<
  typeof loadDatasetOptions
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
  loadDatasetOptionsMock.mockReset();
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

test('renders a combobox — not a bare number input — for a datasetId field, matched by name rather than an x-control hint', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: { dataBinding: { $ref: '#/$defs/DataBinding' } },
        $defs: {
          DataBinding: {
            type: 'object',
            properties: {
              datasetId: { type: 'integer', title: 'Dataset ID' },
            },
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({ json: { result: {} } } as never);

  mount('balloons', { dataBinding: { datasetId: 1 } });

  expect(await screen.findByRole('combobox')).toBeInTheDocument();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
});

test("resolves the bound dataset's own name for the picker label, not just its numeric id", async () => {
  // Regression test: `DatasetControl` must call `AsyncSelect` directly.
  // Wrapping the native filters config modal's `DatasetSelect` component
  // instead — which memoizes its rendered element with an empty dependency
  // array — freezes `value` at whatever it was on first render, so the
  // label would be stuck on the raw numeric id forever once the real name
  // arrives from `useDatasetMetadata`.
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: { dataBinding: { $ref: '#/$defs/DataBinding' } },
        $defs: {
          DataBinding: {
            type: 'object',
            properties: {
              datasetId: { type: 'integer', title: 'Dataset ID' },
            },
          },
        },
      },
    },
  } as never);
  getSpy.mockResolvedValue({
    json: { result: { table_name: 'sales' } },
  } as never);

  mount('balloons', { dataBinding: { datasetId: 3 } });

  expect(
    await screen.findByRole('combobox', { name: 'Dataset ID: sales' }),
  ).toBeInTheDocument();
});

test('picking a dataset writes its id back into dataBinding.datasetId', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: { dataBinding: { $ref: '#/$defs/DataBinding' } },
        $defs: {
          DataBinding: {
            type: 'object',
            properties: {
              datasetId: { type: 'integer', title: 'Dataset ID' },
            },
          },
        },
      },
    },
  } as never);
  // Nothing bound yet, so the aria-label stays the plain "Dataset ID" until
  // the pick below — which is what makes it safe to target by that fixed
  // name — but a successful pick immediately binds `datasetId: 9`, and
  // `useDatasetMetadata` fires its own fetch for *that* dataset's name the
  // moment it does.
  loadDatasetOptionsMock.mockResolvedValue({
    data: [{ label: 'orders', value: 9, table_name: 'orders' }],
    totalCount: 1,
  });
  getSpy.mockResolvedValue({
    json: { result: { table_name: 'orders' } },
  } as never);

  const id = mount('balloons', { dataBinding: {} });

  await selectOption('orders', 'Dataset ID');

  await waitFor(() =>
    expect(
      (provider.getNode(id)?.props?.dataBinding as DataBindingSpec)?.datasetId,
    ).toBe(9),
  );
});

test('never offers a semantic view as a dataset pick — datasetId has no way to represent one', async () => {
  postSpy.mockResolvedValue({
    json: {
      result: {
        type: 'object',
        properties: { dataBinding: { $ref: '#/$defs/DataBinding' } },
        $defs: {
          DataBinding: {
            type: 'object',
            properties: {
              datasetId: { type: 'integer', title: 'Dataset ID' },
            },
          },
        },
      },
    },
  } as never);
  loadDatasetOptionsMock.mockResolvedValue({
    data: [
      {
        label: 'a semantic view',
        value: 'sv:5',
        table_name: 'a semantic view',
        kind: 'semantic_view',
      },
      { label: 'orders', value: 9, table_name: 'orders' },
    ],
    totalCount: 2,
  });

  mount('balloons', { dataBinding: {} });
  await userEvent.click(
    await screen.findByRole('combobox', { name: 'Dataset ID' }),
  );

  expect(await screen.findByText('orders')).toBeInTheDocument();
  expect(screen.queryByText('a semantic view')).not.toBeInTheDocument();
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

test('falls back to the raw JSON editor when a column value is not a string', async () => {
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

  // Hand-authored through the Inspector's JSON tab: not a string, so antd
  // `Select` can't take it as a `value` — this must fall back to the raw
  // JSON editor rather than crash the whole builder.
  mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    colorDimension: { expressionType: 'SIMPLE' },
  });

  expect(await screen.findByText('Color dimension')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

test('falls back to the raw JSON editor when a column-multi entry is not a string', async () => {
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
        columns: [{ column_name: 'gender', type_generic: 1 }],
        metrics: [],
      },
    },
  } as never);

  mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    dimensions: ['gender', { expressionType: 'SIMPLE' }],
  });

  expect(await screen.findByText('Dimensions')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

test('falls back to the raw JSON editor when no dataset is bound yet', async () => {
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

  mount('balloons', { dataBinding: {} });

  expect(await screen.findByText('Dimensions')).toBeInTheDocument();
  // No dataset bound at all: the field must stay editable via the raw JSON
  // editor rather than render an empty, permanently uneditable picker.
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(getSpy).not.toHaveBeenCalled();
});

test('falls back to the raw JSON editor when the dataset metadata fetch fails', async () => {
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
  getSpy.mockRejectedValue(new Error('network error'));

  mount('balloons', { dataBinding: { datasetId: 1, metrics: ['count'] } });

  // Both assertions must be checked together on every retry: before the
  // fetch settles, `ColumnControl` briefly renders the picker instead (whose
  // `Form.Item` label also reads "Color dimension"), so checking the label
  // and the missing combobox separately could pass on that transient,
  // pre-failure render instead of the final, fallen-back one.
  await waitFor(() => {
    expect(screen.getByText('Color dimension')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
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

  // Nothing pre-filled: all three picks below drive their real, nested
  // `dataBinding.*` write-back paths.
  const id = mount('balloons', { dataBinding: { datasetId: 1 } });

  await screen.findByText('Dimensions');
  // Each multi-list's trailing "add" Select carries an accessible name
  // derived from its field label (`Add ${label}`), so it can be targeted
  // directly even with multiple unnamed comboboxes on screen at once.
  const getBinding = () =>
    provider.getNode(id)?.props?.dataBinding as DataBindingSpec | undefined;

  await selectOption('gender', 'Add Dimensions');
  await waitFor(() => expect(getBinding()?.dimensions).toContain('gender'));

  await selectOption('Count', 'Add Metrics');
  await waitFor(() => expect(getBinding()?.metrics).toContain('count'));

  // The dataset mock has exactly one column and one metric, so both
  // multi-lists' "add" selects are now gone (nothing left to add) — leaving
  // `colorDimension`'s Select as the only *other* combobox besides the
  // `datasetId` field's own picker, which is named by its label like every
  // other reference control here.
  await selectOption('gender', 'Color dimension');
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.colorDimension).toBe('gender'),
  );
});
