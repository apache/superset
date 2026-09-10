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
  within,
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

// A form/JSON edit now round-trips through the backend `/validate` endpoint
// before it's committed (see `controlValueValidation.ts`), so every test
// below that writes back through the form needs that call to resolve too —
// not just the `/control-schema` fetch `postSpy` already stood in for.
// Defaulting it to "valid" here keeps every pre-existing write-back
// assertion working unchanged; tests that care about a rejection override
// this per-endpoint behavior themselves.
const mockPost = (
  controlSchemaResult: unknown = SCHEMA,
  validateErrors: unknown[] = [],
) => {
  postSpy.mockImplementation(({ endpoint }: { endpoint: string }) => {
    if (endpoint.endsWith('/validate')) {
      return Promise.resolve({
        json: { result: { errors: validateErrors } },
      } as never);
    }
    return Promise.resolve({ json: { result: controlSchemaResult } } as never);
  });
};

beforeEach(() => {
  provider.reset();
  postSpy.mockReset();
  mockPost();
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

test('a field edit round-trips through the backend /validate endpoint before it commits', async () => {
  const id = mount('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: '',
  });

  await userEvent.type(await screen.findByRole('textbox'), '$');

  await waitFor(() =>
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/api/v1/widgets/type/metric-tile/validate',
        jsonPayload: {
          control_values: expect.objectContaining({ prefix: '$' }),
        },
      }),
    ),
  );
  await waitFor(() => expect(provider.getNode(id)?.props?.prefix).toBe('$'));
});

test('a field edit rejected by backend validation is not committed, and its error is shown', async () => {
  const id = mount('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: 'kept',
  });
  await screen.findByRole('textbox');
  mockPost(SCHEMA, [{ loc: ['prefix'], message: 'Too long' }]);

  await userEvent.type(screen.getByRole('textbox'), 'x');

  expect(await screen.findByText(/prefix: Too long/)).toBeInTheDocument();
  // Rejected atomically: the node this panel reads from was never written to.
  expect(provider.getNode(id)?.props?.prefix).toBe('kept');
});

test('a rejected edit stays in its own field rather than reverting — required-together fields can be picked in either order', async () => {
  // Reverting on every rejection (an earlier fix's own mistake) would undo
  // each step of building up a fresh widget the moment it's made, since
  // `dataBinding`'s required fields only ever validate together — see the
  // dataset/column test above for the deadlock that would cause.
  const id = mount('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: 'kept',
  });
  await screen.findByRole('textbox');
  mockPost(SCHEMA, [{ loc: ['prefix'], message: 'Too long' }]);

  await userEvent.type(screen.getByRole('textbox'), 'x');
  await screen.findByText(/prefix: Too long/);

  expect(screen.getByRole('textbox')).toHaveValue('keptx');
  // The rejected candidate never reached the store.
  expect(provider.getNode(id)?.props?.prefix).toBe('kept');
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
  postSpy.mockImplementation(async config => {
    if (config.endpoint?.endsWith('/validate')) {
      return { json: { result: { errors: [] } } } as never;
    }
    return {
      json: {
        result: (
          config.jsonPayload as { control_values?: { datasetId?: number } }
        )?.control_values?.datasetId
          ? schemaAfterDataset
          : schemaBeforeDataset,
      },
    } as never;
  });
  loadDatasetOptionsMock.mockResolvedValue({
    data: [{ label: 'Sales', value: 1, table_name: 'Sales' }],
    totalCount: 1,
  });
  getSpy.mockResolvedValue({
    json: { result: { table_name: 'Sales' } },
  } as never);

  mount('filter.select', {});

  // Only `datasetId` is a select before any dataset is picked — `column`'s
  // enum is still empty, so it renders as the generic text control.
  await screen.findByText('Dataset ID');
  expect(await screen.findAllByRole('combobox')).toHaveLength(1);

  await selectOption('Sales');

  // Picking the dataset debounces a schema re-fetch carrying `datasetId`
  // along, which comes back with `column`'s enum populated — turning it
  // into a second select, without anything here depending on `series`.
  await waitFor(
    () =>
      expect(
        postSpy.mock.calls.filter(([config]) =>
          config.endpoint?.endsWith('/control-schema'),
        ),
      ).toHaveLength(2),
    { timeout: 3000 },
  );
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

test('renders a column picker for an x-control: "column" field and writes the pick back into props', async () => {
  // Named anything but `colorDimension`, which has its own, more specific
  // control (`ColorDimensionControl`) — this test is about the generic
  // `x-control: "column"` mechanism any other field can use.
  mockPost({
    type: 'object',
    properties: {
      favoriteColumn: {
        type: 'string',
        title: 'Favorite column',
        'x-control': 'column',
      },
    },
  });
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

  await screen.findByText('Favorite column');
  await selectOption('gender');

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.favoriteColumn).toBe('gender'),
  );
});

// `colorDimension` can only ever be a dimension the widget already groups
// by (the backend's `_color_dimension_must_be_grouped` validator rejects
// anything else), so its picker intersects with the sibling
// `dataBinding.dimensions` rather than offering every column.
const COLOR_DIMENSION_SCHEMA = {
  type: 'object',
  properties: {
    colorDimension: {
      type: 'string',
      title: 'Color dimension',
      'x-control': 'column',
    },
  },
};

test('colorDimension is disabled with an explanatory placeholder when nothing is grouped yet', async () => {
  mockPost(COLOR_DIMENSION_SCHEMA);
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'gender', type_generic: 1 }],
        metrics: [],
      },
    },
  } as never);

  mount('balloons', {
    dataBinding: { datasetId: 1, metrics: ['count'], dimensions: [] },
  });

  const picker = await screen.findByRole('combobox', {
    name: 'Color dimension',
  });
  expect(picker).toBeDisabled();
  expect(screen.getByText('Group a dimension first')).toBeInTheDocument();
});

test('colorDimension excludes dataset columns that are not grouped, and offers the ones that are', async () => {
  mockPost(COLOR_DIMENSION_SCHEMA);
  getSpy.mockResolvedValue({
    json: {
      result: {
        // Three columns on the dataset; only `gender` is actually grouped.
        columns: [
          { column_name: 'name', type_generic: 1 },
          { column_name: 'gender', type_generic: 1 },
          { column_name: 'country', type_generic: 1 },
        ],
        metrics: [],
      },
    },
  } as never);

  const id = mount('balloons', {
    dataBinding: {
      datasetId: 1,
      metrics: ['count'],
      dimensions: ['gender'],
    },
  });

  const picker = await screen.findByRole('combobox', {
    name: 'Color dimension',
  });
  expect(picker).toBeEnabled();

  await userEvent.click(picker);
  expect(screen.getByText('gender')).toBeInTheDocument();
  expect(screen.queryByText('name')).not.toBeInTheDocument();
  expect(screen.queryByText('country')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('gender'));
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.colorDimension).toBe('gender'),
  );
});

test('renders an ordered column-multi list for an x-control: "column-multi" field, and picking one writes the array back', async () => {
  mockPost({
    type: 'object',
    properties: {
      dimensions: {
        type: 'array',
        title: 'Dimensions',
        'x-control': 'column-multi',
      },
    },
  });
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

test('the column-multi add-picker resets to its placeholder after a pick, rather than echoing the just-added entry', async () => {
  mockPost({
    type: 'object',
    properties: {
      dimensions: {
        type: 'array',
        title: 'Dimensions',
        'x-control': 'column-multi',
      },
    },
  });
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

  // Settle JsonForms' debounced onChange before asserting the DOM, and
  // before the test ends — otherwise it can fire mid-teardown against a
  // node the next test's `provider.reset()` has already discarded.
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.dimensions).toEqual(['name']),
  );
  expect(screen.getByText('Add field')).toBeInTheDocument();
  // `name` now appears exactly once, as the picked row — not a second time
  // echoed inside the add-picker that's supposed to have reset.
  expect(screen.getAllByText('name')).toHaveLength(1);
});

// The list's order is not cosmetic — it decides which dimension colors the
// balloons by default (`BalloonsWidget`'s own fallback) — so reordering
// needs a keyboard path, not only the drag handle.
test('a column-multi entry can be moved up or down, with the boundary buttons disabled at the ends', async () => {
  mockPost({
    type: 'object',
    properties: {
      dimensions: {
        type: 'array',
        title: 'Dimensions',
        'x-control': 'column-multi',
      },
    },
  });
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
    dimensions: ['name', 'gender'],
  });

  await screen.findByText('Dimensions');
  expect(await screen.findByLabelText('Move name up')).toBeDisabled();
  expect(await screen.findByLabelText('Move gender down')).toBeDisabled();

  await userEvent.click(await screen.findByLabelText('Move gender up'));
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.dimensions).toEqual(['gender', 'name']),
  );
  // Having moved to the top, its own "up" button is now the disabled one.
  expect(await screen.findByLabelText('Move gender up')).toBeDisabled();

  await userEvent.click(await screen.findByLabelText('Move gender down'));
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.dimensions).toEqual(['name', 'gender']),
  );
});

test('renders a metric picker for an x-control: "metric-multi" field and writes the pick back', async () => {
  mockPost({
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        title: 'Metrics',
        'x-control': 'metric-multi',
      },
    },
  });
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
  mockPost({
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
  });
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
  mockPost({
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
  });
  getSpy.mockResolvedValue({
    json: { result: { table_name: 'sales' } },
  } as never);

  mount('balloons', { dataBinding: { datasetId: 3 } });

  expect(
    await screen.findByRole('combobox', { name: 'Dataset ID: sales' }),
  ).toBeInTheDocument();
});

test('picking a dataset writes its id back into dataBinding.datasetId', async () => {
  mockPost({
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
  });
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

test('a dataset pick rejected for still lacking required metrics is still visible to a sibling column picker — a freshly placed widget can be built up field by field', async () => {
  // `DataBinding` requires `datasetId` and `metrics` together; a brand-new
  // widget starts with neither, so its very first pick (just the dataset)
  // is always rejected on its own. If sibling controls only saw the last
  // *accepted* props, none of them would ever learn the picked dataset, and
  // the widget could never be built up at all — this is the deadlock
  // `config.formData` tracking the live (not just accepted) candidate fixes.
  postSpy.mockImplementation(
    ({
      endpoint,
      jsonPayload,
    }: {
      endpoint: string;
      jsonPayload?: { control_values?: { dataBinding?: DataBindingSpec } };
    }) => {
      if (endpoint.endsWith('/validate')) {
        const dataBinding = jsonPayload?.control_values?.dataBinding;
        const errors =
          dataBinding?.datasetId && dataBinding?.metrics?.length
            ? []
            : [{ loc: ['dataBinding'], message: 'Incomplete' }];
        return Promise.resolve({ json: { result: { errors } } } as never);
      }
      return Promise.resolve({
        json: {
          result: {
            type: 'object',
            properties: {
              dataBinding: { $ref: '#/$defs/DataBinding' },
              favoriteColumn: {
                type: 'string',
                title: 'Favorite column',
                'x-control': 'column',
              },
            },
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
    },
  );
  loadDatasetOptionsMock.mockResolvedValue({
    data: [{ label: 'orders', value: 9, table_name: 'orders' }],
    totalCount: 1,
  });
  getSpy.mockResolvedValue({
    json: {
      result: {
        table_name: 'orders',
        columns: [{ column_name: 'gender', type_generic: 1 }],
        metrics: [],
      },
    },
  } as never);

  // A freshly placed widget: no props at all yet.
  mount('balloons');
  await screen.findByText('Favorite column');

  await selectOption('orders', 'Dataset ID');

  // Rejected — `metrics` is still missing.
  await screen.findByTestId('schema-control-panel-validation-errors');

  // ...but the column picker can already query dataset 9's own columns,
  // because it reads the just-picked (though rejected) datasetId off
  // `config.formData`, not off the last-committed `node.props`.
  await waitFor(() =>
    expect(getSpy).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/dataset/9' }),
    ),
  );
});

test('never offers a semantic view as a dataset pick — datasetId has no way to represent one', async () => {
  mockPost({
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
  });
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

test('an existing ad-hoc aggregate metric renders as its own editable row, not a whole-field JSON fallback', async () => {
  mockPost({
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        title: 'Metrics',
        'x-control': 'metric-multi',
      },
    },
  });
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
  // The ad-hoc entry's own computed label, not a raw JSON textarea — proof
  // the mixed list rendered instead of the whole-field CodeControl fallback.
  const row = await screen.findByText('SUM(sales)');
  // Never opened yet — antd's Popover doesn't mount `content` before its
  // first open (only stays mounted-but-hidden after that).
  expect(screen.queryByTestId('adhoc-metric-editor')).not.toBeInTheDocument();

  await userEvent.click(row);

  expect(await screen.findByTestId('adhoc-metric-editor')).toBeInTheDocument();
});

test('editing an ad-hoc metric through the popover updates the stored value and closes it', async () => {
  mockPost({
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        title: 'Metrics',
        'x-control': 'metric-multi',
      },
    },
  });
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'sales', verbose_name: 'Sales' }],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  const id = mount('balloons', {
    dataBinding: { datasetId: 1 },
    metrics: [
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'sales' },
        aggregate: 'SUM',
      },
    ],
  });

  await userEvent.click(await screen.findByText('SUM(sales)'));
  await screen.findByTestId('adhoc-metric-editor');

  await selectOption('AVG', 'Aggregate');
  await userEvent.click(screen.getByTestId('adhoc-metric-editor-save'));

  await waitFor(() => {
    const metrics = provider.getNode(id)?.props?.metrics as Record<
      string,
      unknown
    >[];
    expect(metrics[0]).toMatchObject({
      expressionType: 'SIMPLE',
      aggregate: 'AVG',
    });
  });
  // A successful save changes `node.props`, which remounts the whole
  // JsonForms tree (SchemaControlPanel's external-edit resync effect) — the
  // popover isn't just closed, its mount is gone entirely.
  expect(screen.queryByTestId('adhoc-metric-editor')).not.toBeInTheDocument();
});

test('adding a custom metric opens a blank editor and appends the saved value', async () => {
  mockPost({
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        title: 'Metrics',
        'x-control': 'metric-multi',
      },
    },
  });
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'sales', verbose_name: 'Sales' }],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
      },
    },
  } as never);

  const id = mount('balloons', { dataBinding: { datasetId: 1 }, metrics: [] });

  await screen.findByText('Metrics');
  await selectOption('Custom metric…', 'Add Metrics');
  const editor = await screen.findByTestId('adhoc-metric-editor');

  // Not `selectOption` here: its `.rc-virtual-list` lookup grabs whichever
  // dropdown is first in the DOM, and the "Add Metrics" select above stays
  // mounted (hidden) after its own dropdown has already been opened once —
  // querying by the picked option's own (page-unique) text sidesteps that.
  await userEvent.click(
    within(editor).getByRole('combobox', { name: 'Column' }),
  );
  await userEvent.click(await screen.findByText('Sales'));
  await userEvent.click(
    within(editor).getByRole('combobox', { name: 'Aggregate' }),
  );
  await userEvent.click(await screen.findByText('SUM'));
  await userEvent.click(screen.getByTestId('adhoc-metric-editor-save'));

  await waitFor(() => {
    const metrics = provider.getNode(id)?.props?.metrics as Record<
      string,
      unknown
    >[];
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      expressionType: 'SIMPLE',
      aggregate: 'SUM',
      column: { column_name: 'sales' },
    });
  });
});

test('cancelling an ad-hoc metric edit leaves the stored value unchanged', async () => {
  mockPost({
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        title: 'Metrics',
        'x-control': 'metric-multi',
      },
    },
  });
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [{ column_name: 'sales', verbose_name: 'Sales' }],
        metrics: [],
      },
    },
  } as never);

  const id = mount('balloons', {
    dataBinding: { datasetId: 1 },
    metrics: [
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'sales' },
        aggregate: 'SUM',
      },
    ],
  });

  await userEvent.click(await screen.findByText('SUM(sales)'));
  await selectOption('AVG', 'Aggregate');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  // antd's Popover keeps `content` mounted (hidden via CSS) rather than
  // unmounting it when closed, so "closed" is a visibility check, not
  // presence.
  expect(screen.getByTestId('adhoc-metric-editor')).not.toBeVisible();
  const metrics = provider.getNode(id)?.props?.metrics as Record<
    string,
    unknown
  >[];
  expect(metrics[0]).toMatchObject({ aggregate: 'SUM' });
});

test('a dataset that disallows ad-hoc metrics disables editing an existing ad-hoc entry', async () => {
  mockPost({
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        title: 'Metrics',
        'x-control': 'metric-multi',
      },
    },
  });
  getSpy.mockResolvedValue({
    json: {
      result: {
        columns: [],
        metrics: [{ metric_name: 'count', verbose_name: 'Count' }],
        extra: '{"disallow_adhoc_metrics": true}',
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

  const row = await screen.findByText('SUM(sales)');
  await userEvent.click(row);

  // The click never opened it — the popover is never even mounted, not
  // merely hidden — since `canEdit` is false for a disallowed dataset.
  expect(screen.queryByTestId('adhoc-metric-editor')).not.toBeInTheDocument();
});

test('a mixed list of a saved metric and an ad-hoc metric renders both as separate rows', async () => {
  mockPost({
    type: 'object',
    properties: {
      metrics: {
        type: 'array',
        title: 'Metrics',
        'x-control': 'metric-multi',
      },
    },
  });
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
      'count',
      {
        expressionType: 'SIMPLE',
        column: { column_name: 'sales' },
        aggregate: 'SUM',
      },
    ],
  });

  expect(await screen.findByText('Count')).toBeInTheDocument();
  expect(await screen.findByText('SUM(sales)')).toBeInTheDocument();
});

test('falls back to the raw JSON editor when a column value is not a string', async () => {
  mockPost({
    type: 'object',
    properties: {
      colorDimension: {
        type: 'string',
        title: 'Color dimension',
        'x-control': 'column',
      },
    },
  });
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
  mockPost({
    type: 'object',
    properties: {
      dimensions: {
        type: 'array',
        title: 'Dimensions',
        'x-control': 'column-multi',
      },
    },
  });
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
  mockPost({
    type: 'object',
    properties: {
      dimensions: {
        type: 'array',
        title: 'Dimensions',
        'x-control': 'column-multi',
      },
    },
  });

  mount('balloons', { dataBinding: {} });

  expect(await screen.findByText('Dimensions')).toBeInTheDocument();
  // No dataset bound at all: the field must stay editable via the raw JSON
  // editor rather than render an empty, permanently uneditable picker.
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(getSpy).not.toHaveBeenCalled();
});

test('falls back to the raw JSON editor when the dataset metadata fetch fails', async () => {
  mockPost({
    type: 'object',
    properties: {
      colorDimension: {
        type: 'string',
        title: 'Color dimension',
        'x-control': 'column',
      },
    },
  });
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
  mockPost({
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
  });
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

// `Customization.series`, shaped the way the backend's `enrich_schema` leaves
// it once a grouping dimension has real, discovered values: a fixed set of
// per-value sub-schemas (a title and a palette-defaulted `color`), each with
// `x-dynamic` living on the parent `series` field rather than on any one
// entry.
const seriesSchema = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    customize: { $ref: '#/$defs/Customization' },
  },
  $defs: {
    Customization: {
      type: 'object',
      properties: {
        series: {
          type: 'object',
          title: 'Per-series styling',
          'x-dynamic': true,
          properties,
        },
      },
    },
  },
});

const BOY_GIRL_PROPERTIES = {
  boy: {
    type: 'object',
    title: 'boy',
    properties: {
      color: {
        type: 'string',
        title: 'Color',
        default: '#e74c3c',
        'x-control': 'color',
      },
      sizeScale: {
        type: 'number',
        title: 'Size scale (×)',
        default: 1,
        minimum: 0.25,
        maximum: 4,
      },
    },
  },
  girl: {
    type: 'object',
    title: 'girl',
    properties: {
      color: {
        type: 'string',
        title: 'Color',
        default: '#3498db',
        'x-control': 'color',
      },
      sizeScale: {
        type: 'number',
        title: 'Size scale (×)',
        default: 1,
        minimum: 0.25,
        maximum: 4,
      },
    },
  },
};

test('an x-dynamic series field with no discovered series yet explains why, instead of an empty group', async () => {
  mockPost(seriesSchema({}));

  mount('balloons', {});

  expect(
    await screen.findByText('No series available to customize yet.'),
  ).toBeInTheDocument();
});

test('a populated x-dynamic series field renders collapsed with a customized count, not one group per entry', async () => {
  mockPost(seriesSchema(BOY_GIRL_PROPERTIES));

  mount('balloons', {});

  expect(
    await screen.findByText('2 series · 0 customized'),
  ).toBeInTheDocument();
  // Collapsed: neither series' own controls are in the document yet.
  expect(screen.queryByLabelText('boy size scale')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('girl size scale')).not.toBeInTheDocument();
});

test('picking a series from the overrides picker writes its palette-defaulted style back', async () => {
  mockPost(seriesSchema(BOY_GIRL_PROPERTIES));

  const id = mount('balloons', {});

  await userEvent.click(await screen.findByText('2 series · 0 customized'));
  await selectOption('girl', 'Add Per-series styling override');

  await waitFor(() =>
    expect(
      (provider.getNode(id)?.props?.customize as Record<string, unknown>)
        ?.series,
    ).toEqual({ girl: { color: '#3498db', sizeScale: 1 } }),
  );
  expect(
    await screen.findByText('2 series · 1 customized'),
  ).toBeInTheDocument();
  // Picked once, it's no longer offered a second time.
  expect(
    screen.queryByRole('option', { name: 'girl' }),
  ).not.toBeInTheDocument();
});

test('resetting a customized series removes it from customize.series entirely', async () => {
  mockPost(seriesSchema(BOY_GIRL_PROPERTIES));

  const id = mount('balloons', {
    customize: { series: { boy: { color: '#123456', sizeScale: 2 } } },
  });

  await userEvent.click(await screen.findByText('2 series · 1 customized'));
  await userEvent.click(await screen.findByLabelText('Reset boy to default'));

  await waitFor(() =>
    expect(
      (provider.getNode(id)?.props?.customize as Record<string, unknown>)
        ?.series,
    ).toEqual({}),
  );
  expect(
    await screen.findByText('2 series · 0 customized'),
  ).toBeInTheDocument();
});

test('editing a customized series size scale writes the new value back', async () => {
  mockPost(seriesSchema(BOY_GIRL_PROPERTIES));

  const id = mount('balloons', {
    customize: { series: { boy: { color: '#e74c3c', sizeScale: 1 } } },
  });

  await userEvent.click(await screen.findByText('2 series · 1 customized'));
  const sizeInput = await screen.findByLabelText('boy size scale');
  await userEvent.clear(sizeInput);
  await userEvent.type(sizeInput, '2.5');
  await userEvent.tab();

  await waitFor(() =>
    expect(
      (provider.getNode(id)?.props?.customize as Record<string, unknown>)
        ?.series,
    ).toEqual({ boy: { color: '#e74c3c', sizeScale: 2.5 } }),
  );
});

test('a customized series exposes an accessibly-labeled color trigger', async () => {
  mockPost(seriesSchema(BOY_GIRL_PROPERTIES));

  mount('balloons', {
    customize: { series: { boy: { color: '#e74c3c', sizeScale: 1 } } },
  });

  await userEvent.click(await screen.findByText('2 series · 1 customized'));
  expect(await screen.findByLabelText('boy color')).toBeInTheDocument();
});

// The backend authors a `description` on every field in `controls.py`; the
// custom renderers thread it into each field's `Form.Item` `tooltip` (an
// info icon, `.ant-form-item-tooltip`) rather than rendering nothing. Antd's
// own Tooltip only mounts its text into the document on hover — these
// assert the icon is offered at all, which is what each renderer actually
// controls; antd's hover behavior is that library's own concern, not this
// file's.
test('a field with a backend-authored description offers a tooltip on its picker', async () => {
  mockPost({
    type: 'object',
    properties: {
      datasetId: {
        type: 'integer',
        title: 'Dataset ID',
        description: 'Numeric id of the dataset to query.',
      },
    },
  });

  mount('balloons', {});

  await screen.findByText('Dataset ID');
  expect(document.querySelector('.ant-form-item-tooltip')).toBeInTheDocument();
});

test('a field with a backend-authored description offers a tooltip even while it is falling back to the raw JSON editor', async () => {
  mockPost({
    type: 'object',
    properties: {
      dimensions: {
        type: 'array',
        title: 'Dimensions',
        'x-control': 'column-multi',
        description: 'Columns to group by (the categories / series).',
      },
    },
  });

  // No dataset bound, so this falls back to `CodeControl` — the description
  // must still carry through that fallback path, not only the picker.
  mount('balloons', { dataBinding: {} });

  await screen.findByText('Dimensions');
  expect(document.querySelector('.ant-form-item-tooltip')).toBeInTheDocument();
});

const seriesSchemaWithDescription = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties: {
    customize: { $ref: '#/$defs/Customization' },
  },
  $defs: {
    Customization: {
      type: 'object',
      properties: {
        series: {
          type: 'object',
          title: 'Per-series styling',
          description:
            "Per-series balloon styling, populated dynamically once the grouping dimension's distinct values are known.",
          'x-dynamic': true,
          properties,
        },
      },
    },
  },
});

test("an x-dynamic series field's own description reaches its tooltip in the empty state", async () => {
  mockPost(seriesSchemaWithDescription({}));

  mount('balloons', {});

  await screen.findByText('Per-series styling');
  expect(document.querySelector('.ant-form-item-tooltip')).toBeInTheDocument();
});

test("an x-dynamic series field's own description reaches its tooltip in the populated state", async () => {
  mockPost(seriesSchemaWithDescription(BOY_GIRL_PROPERTIES));

  mount('balloons', {});

  await screen.findByText('2 series · 0 customized');
  expect(document.querySelector('.ant-form-item-tooltip')).toBeInTheDocument();
});

// `x-control: "select"` — the echarts `chartType` picker. A plain
// nullable enum, tested independent of the echarts widget itself since
// `mockPost` stands in for whatever schema is served.
const SELECT_SCHEMA = {
  type: 'object',
  properties: {
    chartType: {
      type: ['string', 'null'],
      title: 'Chart type',
      'x-control': 'select',
      'x-options': ['bar', 'line', 'scatter'],
    },
  },
};

test('an x-control: select field renders its x-options and commits a pick', async () => {
  mockPost(SELECT_SCHEMA);
  const id = mount('echarts', { chartType: null });

  const select = await screen.findByRole('combobox', { name: 'Chart type' });
  await userEvent.click(select);
  await userEvent.click(await screen.findByText('bar'));

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.chartType).toBe('bar'),
  );
});

test('clearing an x-control: select field writes null (Custom/unset), not an empty string', async () => {
  mockPost(SELECT_SCHEMA);
  const id = mount('echarts', { chartType: 'bar' });
  await screen.findByRole('combobox', { name: 'Chart type' });

  await userEvent.click(document.querySelector('.ant-select-clear')!);

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.chartType).toBeNull(),
  );
});

// A per-series entry shape that isn't Balloons' {color, sizeScale} — proves
// SeriesOverridesControl renders by schema shape, not a hard-coded field
// list: a boolean (`visible`, a toggle) and a plain string (`displayName`,
// a text input) alongside the color swatch every entry shares.
const ECHARTS_SERIES_PROPERTIES = {
  count: {
    type: 'object',
    title: 'count',
    properties: {
      color: {
        type: 'string',
        title: 'Color',
        default: '#e74c3c',
        'x-control': 'color',
      },
      visible: { type: 'boolean', title: 'Visible', default: true },
      displayName: { type: 'string', title: 'Display name', default: '' },
    },
  },
};

test('a non-Balloons series entry shape (color + boolean + string) renders each field by its own schema type', async () => {
  mockPost(seriesSchema(ECHARTS_SERIES_PROPERTIES));

  const id = mount('echarts', {
    customize: {
      series: { count: { color: '#e74c3c', visible: true, displayName: '' } },
    },
  });

  await userEvent.click(await screen.findByText('1 series · 1 customized'));

  expect(await screen.findByLabelText('count color')).toBeInTheDocument();
  const visibleToggle = await screen.findByLabelText('count visible');
  const nameInput = await screen.findByLabelText('count display name');

  await userEvent.click(visibleToggle);
  await waitFor(() =>
    expect(
      (provider.getNode(id)?.props?.customize as Record<string, unknown>)
        ?.series,
    ).toEqual({ count: { color: '#e74c3c', visible: false, displayName: '' } }),
  );

  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, 'Total');
  await waitFor(() =>
    expect(
      (
        (provider.getNode(id)?.props?.customize as Record<string, unknown>)
          ?.series as Record<string, Record<string, unknown>>
      )?.count?.displayName,
    ).toBe('Total'),
  );
});

// `x-hidden-in-form` — echarts' `echartsOptions` (already fully editable via
// the Inspector's JSON tab) must not also render its own raw-JSON box in the
// Form tab, but the field must stay fully intact in the committed data.
const HIDDEN_FIELD_SCHEMA = {
  type: 'object',
  properties: {
    chartType: { type: ['string', 'null'], title: 'Chart type' },
    echartsOptions: {
      type: 'object',
      title: 'ECharts option',
      'x-control': 'code',
      'x-hidden-in-form': true,
    },
  },
};

test('a field flagged x-hidden-in-form renders no control in the Form tab', async () => {
  mockPost(HIDDEN_FIELD_SCHEMA);

  mount('echarts', { echartsOptions: { series: [{ type: 'bar' }] } });

  await screen.findByText('Chart type');
  expect(screen.queryByText('ECharts option')).not.toBeInTheDocument();
});

test('a field hidden from the Form tab keeps its stored value untouched', async () => {
  mockPost(HIDDEN_FIELD_SCHEMA);

  const id = mount('echarts', {
    echartsOptions: { series: [{ type: 'bar' }] },
  });
  await screen.findByText('Chart type');

  expect(provider.getNode(id)?.props?.echartsOptions).toEqual({
    series: [{ type: 'bar' }],
  });
});

// Guards the exact bug caught during implementation: a nested-object field
// two levels deep (chrome.title.text) rendered as an empty group with no
// fields inside, since JsonForms only renders one level of nested-object
// properties. `EchartsChrome` is deliberately flat (`chrome.titleText`,
// `chrome.legendShow`, ...) to avoid it — this proves the flat shape
// actually renders its fields, not just that the schema declares them.
const CHROME_SCHEMA = {
  type: 'object',
  properties: {
    chrome: { $ref: '#/$defs/EchartsChrome' },
  },
  $defs: {
    EchartsChrome: {
      type: 'object',
      title: 'Chrome',
      properties: {
        titleText: { type: 'string', title: 'Title' },
        legendShow: { type: 'boolean', title: 'Show legend', default: true },
        legendPosition: {
          type: ['string', 'null'],
          title: 'Legend position',
          'x-control': 'select',
          'x-options': ['top', 'bottom', 'left', 'right'],
        },
      },
    },
  },
};

test('a flat (one-level) nested chrome object renders its own fields, not an empty group', async () => {
  mockPost(CHROME_SCHEMA);

  const id = mount('echarts', {});

  await screen.findByText('Chrome');
  // Presence of all three fields — including the boolean one — proves the
  // group actually expanded, not just that a "Chrome" header exists.
  expect(screen.getByText('Title')).toBeInTheDocument();
  expect(screen.getByText('Show legend')).toBeInTheDocument();
  expect(screen.getByText('Legend position')).toBeInTheDocument();

  const titleInput = await screen.findByRole('textbox', { name: 'Title' });
  await userEvent.type(titleInput, 'Sales');
  await waitFor(() =>
    expect(
      (provider.getNode(id)?.props?.chrome as Record<string, unknown>)
        ?.titleText,
    ).toBe('Sales'),
  );

  const positionSelect = await screen.findByRole('combobox', {
    name: 'Legend position',
  });
  await userEvent.click(positionSelect);
  await userEvent.click(await screen.findByText('right'));
  await waitFor(() =>
    expect(
      (provider.getNode(id)?.props?.chrome as Record<string, unknown>)
        ?.legendPosition,
    ).toBe('right'),
  );
});
