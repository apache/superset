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
import fetchMock from 'fetch-mock';
import {
  screen,
  waitFor,
  userEvent,
  selectOption,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import type { DatasetObject } from 'src/features/datasets/types';
import {
  createProps,
  DATASOURCE_ENDPOINT,
  setupDatasourceEditorMocks,
  cleanupAsyncOperations,
  fastRender,
  dismissDatasourceWarning,
  type DatasourceEditorProps,
} from './DatasourceEditor.test.utils';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const PREVIEW_URL = 'glob:*/api/v1/dataset/*/partition_mapping/preview/';

type EditorColumn = DatasetObject['columns'][number] & {
  partition_value_transform?: string | null;
  partition_transform_is_monotonic?: boolean;
};

/** The saved columns from the editor's most recent `onChange`. */
const lastSavedColumns = (props: DatasourceEditorProps): EditorColumn[] => {
  const { calls } = props.onChange.mock;
  return calls[calls.length - 1][0].columns as EditorColumn[];
};

const columnNamed = (columns: EditorColumn[], name: string) =>
  columns.find(column => column.column_name === name);

beforeEach(() => {
  fetchMock.get(DATASOURCE_ENDPOINT, [], { name: DATASOURCE_ENDPOINT });
  setupDatasourceEditorMocks();
  // The transform field previews on a debounce as soon as it is mounted with a
  // previewable transform; without this the request escapes the test.
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });
  // Only this flag: a blanket `true` also turns on advanced data types and
  // dataset folders, which change the DOM these tests read.
  jest
    .mocked(isFeatureEnabled)
    .mockImplementation(flag => flag === FeatureFlag.PartitionFilterMapping);
});

afterEach(async () => {
  await cleanupAsyncOperations();
  fetchMock.clearHistory().removeRoutes();
  jest.mocked(isFeatureEnabled).mockReset();
});

test('removing the mapping does not leave the default datetime column mirroring', async () => {
  // `ds` is the default datetime column and holds a transform of its own while
  // the mapping sits explicitly on `state`. A dataset reaches that state by
  // re-pointing the default datetime column, or through the import/PUT API,
  // and until now nothing cleaned it up: clearing the override dropped the
  // mapping back onto `ds`, where the leftover transform switched mirroring
  // straight back on under a different column.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = 'num';
  // The editor offers partition mapping only on an engine that advertises it,
  // so the fixture has to say the engine does.
  props.datasource.supports_partition_filter_mapping = true;
  props.datasource.partition_mapped_column = 'state';
  const seeded = props.datasource.columns as EditorColumn[];
  columnNamed(seeded, 'ds')!.partition_value_transform =
    'unix_timestamp(:value)';
  columnNamed(seeded, 'ds')!.partition_transform_is_monotonic = true;
  columnNamed(seeded, 'state')!.partition_value_transform = 'lower(:value)';

  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));

  // The mapping is live on `state` before the click.
  expect(
    await screen.findByText(/will automatically apply an equivalent filter/),
  ).toBeInTheDocument();

  await userEvent.type(
    await screen.findByPlaceholderText('Search columns by name'),
    'state',
  );
  await userEvent.click((await screen.findAllByLabelText(/expand row/i))[0]);
  // By its test id, not its label: the mapping here is an explicit override on
  // a dataset that has a default datetime column, so the action reads "Reset to
  // default datetime column". Same handler either way.
  await userEvent.click(await screen.findByTestId('remove-partition-mapping'));

  // Nothing mirrors any more, and the panel says so rather than quietly
  // re-pointing at `ds`.
  expect(
    await screen.findByText(/No value transform is set on ds/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/will automatically apply an equivalent filter/),
  ).not.toBeInTheDocument();

  await waitFor(() => {
    expect(
      lastSavedColumns(props).every(
        column =>
          !column.partition_value_transform &&
          !column.partition_transform_is_monotonic,
      ),
    ).toBe(true);
  });
});

test('re-pointing the default datetime column takes the mapping with it', async () => {
  // With no override the mapped column *is* `main_dttm_col`, so the mapping
  // moves either way. What must not happen is the transform staying behind on
  // the old column, invisible but saved and ready to go live again.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = 'num';
  props.datasource.supports_partition_filter_mapping = true;
  props.datasource.partition_mapped_column = null;
  const seeded = props.datasource.columns as EditorColumn[];
  columnNamed(seeded, 'ds')!.partition_value_transform =
    'unix_timestamp(:value)';
  columnNamed(seeded, 'ds')!.partition_transform_is_monotonic = true;
  seeded.push({
    id: 99,
    type: 'DATETIME',
    filterable: false,
    is_dttm: true,
    is_active: true,
    expression: '',
    groupby: false,
    column_name: 'ingest_time',
  } as EditorColumn);

  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));
  await screen.findByTestId('default-datetime-column-select');

  await selectOption('ingest_time', 'Default datetime column');

  await waitFor(() => {
    const columns = lastSavedColumns(props);
    expect(columnNamed(columns, 'ingest_time')).toMatchObject({
      partition_value_transform: 'unix_timestamp(:value)',
      partition_transform_is_monotonic: true,
    });
    expect(columnNamed(columns, 'ds')).toMatchObject({
      partition_value_transform: null,
      partition_transform_is_monotonic: false,
    });
  });

  expect(
    await screen.findByText(
      /Filters on ingest_time will automatically apply an equivalent filter to num/,
    ),
  ).toBeInTheDocument();
});

test('the mapping will not follow the default datetime column onto a calculated column', async () => {
  // A calculated column can be the default datetime column, but its row never
  // renders the transform editor -- carrying a transform there would make a
  // live mapping with no UI to see or undo it. The mapping goes inert instead,
  // and nothing is left behind on the old column either.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = 'num';
  props.datasource.supports_partition_filter_mapping = true;
  props.datasource.partition_mapped_column = null;
  const seeded = props.datasource.columns as EditorColumn[];
  columnNamed(seeded, 'ds')!.partition_value_transform =
    'unix_timestamp(:value)';
  seeded.push({
    id: 98,
    type: 'DATETIME',
    filterable: false,
    is_dttm: true,
    is_active: true,
    expression: 'DATE_TRUNC("day", ds)',
    groupby: false,
    column_name: 'ds_day',
  } as EditorColumn);

  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));
  await screen.findByTestId('default-datetime-column-select');

  await selectOption('ds_day', 'Default datetime column');

  await waitFor(() => {
    expect(
      lastSavedColumns(props).every(
        column => !column.partition_value_transform,
      ),
    ).toBe(true);
  });

  expect(
    await screen.findByText(/No value transform is set on ds_day/),
  ).toBeInTheDocument();
});
