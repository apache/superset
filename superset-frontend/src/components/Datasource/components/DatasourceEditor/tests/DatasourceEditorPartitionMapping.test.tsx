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

/**
 * The validation errors from the editor's most recent `onChange`.
 *
 * What DatasourceModal disables Save on, so this is the save gate as the modal
 * sees it.
 */
const lastValidationErrors = (props: DatasourceEditorProps): string[] => {
  const { calls } = props.onChange.mock;
  return (calls[calls.length - 1][1] ?? []) as string[];
};

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
  await userEvent.click(await screen.findByText('Remove mapping'));

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

test('re-pointing the default datetime column leaves the value transform behind', async () => {
  // With no override the mapped column *is* `main_dttm_col`, so the mapping
  // moves either way. The transform does not travel with it: it was written
  // about the old column, and asserting it on a new one mirrors an expression
  // nobody checked there. It must not stay behind on the old column either --
  // invisible but saved, and ready to go live again.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = 'num';
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
    // The new default never held a mapping, so it is handed back untouched --
    // which is the same thing as holding no transform.
    const arrived = columnNamed(columns, 'ingest_time');
    expect(arrived?.partition_value_transform ?? null).toBeNull();
    expect(arrived?.partition_transform_is_monotonic ?? false).toBe(false);
    expect(columnNamed(columns, 'ds')).toMatchObject({
      partition_value_transform: null,
      partition_transform_is_monotonic: false,
    });
  });

  // The mapping is designated but inert, and the editor says so rather than
  // promising a mirror it is not performing.
  expect(
    await screen.findByText(/No value transform is set on ingest_time/),
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

test('a mapping onto a bare non-temporal column blocks the save', async () => {
  // `state` is a VARCHAR, so it has no engine default to fall back on and the
  // transform field marks itself required. Until now that marker was decorative:
  // the save went through, the PUT filed it as a non-blocking issue, and the
  // mapping sat inactive with nothing saying so at the field.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = null;
  props.datasource.partition_mapped_column = 'state';

  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));
  await screen.findByTestId('partition-column-select');

  await selectOption('num', 'Partition column');

  await waitFor(() => {
    expect(lastValidationErrors(props)).toEqual([
      expect.stringContaining('A value transform is required on state'),
    ]);
  });
});

test('a mapping onto the default datetime column does not block the save', async () => {
  // The other side of the check: a temporal column with no transform is the
  // "saved but inactive" case the PRD asks for, so picking a partition column
  // must not strand the owner with a disabled Save button.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = null;
  props.datasource.partition_mapped_column = null;

  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));
  await screen.findByTestId('partition-column-select');

  await selectOption('num', 'Partition column');

  await waitFor(() => {
    expect(props.onChange).toHaveBeenCalled();
  });
  expect(lastValidationErrors(props)).toEqual([]);
});

test('with the feature off, re-pointing the default datetime column keeps the transform', async () => {
  // The transform controls, the validation and the partition picker are all
  // flag-gated, but the "Default datetime column" select is not -- it predates
  // this feature. So with the flag off an owner could re-point it, never see a
  // mapping control, and silently lose stored configuration on save. The
  // backend gate does not cover it: the cleared value travels as an explicit
  // null inside the `columns` payload, which `update_columns` writes whatever
  // the flag says.
  jest.mocked(isFeatureEnabled).mockImplementation(() => false);

  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = 'num';
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
    expect(props.onChange).toHaveBeenCalled();
  });
  expect(columnNamed(lastSavedColumns(props), 'ds')).toMatchObject({
    partition_value_transform: 'unix_timestamp(:value)',
    partition_transform_is_monotonic: true,
  });
});

test('DatasourceEditor source pins syncMetadata to the live column state', () => {
  // Source-pin, for the same reason the sibling pin in `DatasourceEditor.test.tsx`
  // exists: this file's own note records that the sync button cannot be
  // triggered from jest -- `fetchSyncedColumns` goes through `SupersetClient`,
  // and the request never settles under the test harness, so neither toast
  // fires and there is no observable outcome to assert on.
  //
  // What the pin locks is the merge base. `datasource.columns` is the
  // mount-time snapshot and never moves: no `setDatasource` call writes
  // `columns`, and the props-sync effect only re-seeds the two column states.
  // `updateColumns` passes an unchanged column through verbatim, so merging a
  // sync against that snapshot restores whatever the dataset held when the
  // modal opened -- the transform and monotonicity flag the owner just
  // cleared, a `filterable`/`groupby` flag they just toggled, any description
  // edited this session. The merge semantics themselves are covered in
  // `utils/partitionMapping.test.ts`.
  // eslint-disable-next-line global-require
  const { readFileSync } = require('fs');
  // eslint-disable-next-line global-require
  const { join } = require('path');
  const src = readFileSync(
    join(__dirname, '..', 'DatasourceEditor.tsx'),
    'utf8',
  );

  // The merge reads the live state, not the mount-time snapshot.
  expect(src).toMatch(
    /const columnChanges = updateColumns\(\s*currentColumns,/,
  );
  expect(src).not.toMatch(
    /const columnChanges = updateColumns\(\s*datasource\.columns,/,
  );

  // And the live state is both column collections, memoized on both.
  expect(src).toMatch(
    /const currentColumns = useMemo\(\s*[\s\S]{0,900}?\(\) => \[\.\.\.databaseColumns, \.\.\.calculatedColumns\],\s*\[databaseColumns, calculatedColumns\],/,
  );
});

test('"Customize the value transform" opens the mapped column\'s editor', async () => {
  // The link filters the table to the mapped column *and* asks for its row to
  // open. The expansion half was inert -- the editor passed `expandItemWhere`
  // but `CollectionTable` no longer consumed it -- so clicking the link left
  // the transform field out of reach behind a manual expand.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = 'num';
  props.datasource.partition_mapped_column = 'state';
  const seeded = props.datasource.columns as EditorColumn[];
  columnNamed(seeded, 'state')!.partition_value_transform = 'lower(:value)';

  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));

  await userEvent.click(
    await screen.findByRole('button', {
      name: 'Customize the value transform →',
    }),
  );

  // No manual expand in between: the transform field is on screen.
  expect(
    await screen.findByTestId('partition-value-transform'),
  ).toBeInTheDocument();
});

test("the mapped column's row is muted in the columns table", async () => {
  // `StyledColumnsTableWrapper` styles `.partition-column-row`, which the
  // editor asks for through `rowClassName`. Without the table applying it the
  // styling was dead and the partition row read as an ordinary column.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = 'num';
  props.datasource.partition_mapped_column = 'state';

  const { container } = fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));

  await waitFor(() => {
    expect(container.querySelectorAll('tr.partition-column-row')).toHaveLength(
      1,
    );
  });
  expect(container.querySelector('tr.partition-column-row')).toHaveTextContent(
    'num',
  );
});

test('designating a partition column leaves its filterable and groupby flags alone', async () => {
  // The customer's decision (2026-09-22): marking a column as the partition
  // column must not change its "Is filterable" / "Is dimension" flags, and the
  // column stays visible in Explore. The editor forced both to false, which
  // silently changed behaviour for a dataset that already exposes its partition
  // key -- and once the sync merged against live state rather than the
  // mount-time snapshot, the unticking survived the save instead of being
  // quietly reverted by it.
  //
  // `gender` is the probe because it starts with both flags set; `num`, the
  // column these tests usually map, ships with both already false and so could
  // not tell the two behaviours apart.
  const props = createProps();
  props.datasource.main_dttm_col = 'ds';
  props.datasource.partition_column = null;
  props.datasource.partition_mapped_column = null;

  fastRender(props);
  await dismissDatasourceWarning();
  await userEvent.click(await screen.findByTestId('collection-tab-Columns'));
  await screen.findByTestId('partition-column-select');

  await selectOption('gender', 'Partition column');

  await waitFor(() => {
    expect(props.onChange).toHaveBeenCalled();
  });
  expect(columnNamed(lastSavedColumns(props), 'gender')).toMatchObject({
    filterable: true,
    groupby: true,
  });
});
