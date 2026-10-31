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
import { useState } from 'react';
import fetchMock from 'fetch-mock';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { getClientErrorObject } from '@superset-ui/core';
import PartitionColumnFields from './PartitionColumnFields';
import PartitionMappingSection from './PartitionMappingSection';

// Only `getClientErrorObject`, and only so one test can hold an error mid
// normalization; everything else in the module behaves as it really does.
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getClientErrorObject: jest.fn((...args: unknown[]) =>
    jest
      .requireActual('@superset-ui/core')
      .getClientErrorObject(...(args as [unknown])),
  ),
}));

const COLUMNS = [
  { column_name: 'event_time', type: 'TIMESTAMP', is_dttm: true },
  { column_name: 'dt_epoch', type: 'BIGINT' },
  { column_name: 'country', type: 'TEXT' },
];

// `COLUMNS` with the mapping actually configured on `event_time`.
const MAPPED_COLUMNS = COLUMNS.map(column =>
  column.column_name === 'event_time'
    ? { ...column, partition_value_transform: 'unix_timestamp(:value)' }
    : column,
);

// A transform naming the column instead of `:value`, which cannot preview.
const PLACEHOLDERLESS_COLUMNS = COLUMNS.map(column =>
  column.column_name === 'event_time'
    ? { ...column, partition_value_transform: 'unix_timestamp(event_time)' }
    : column,
);

const PREVIEW_URL = 'glob:*/api/v1/dataset/1/partition_mapping/preview/';

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  // Call history only: the module-level implementation delegates to the real
  // `getClientErrorObject`, and `mockReset` would throw that away for every
  // test after this one.
  (getClientErrorObject as jest.Mock).mockClear();
});

test('the mapped column shows as following the default datetime column', () => {
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: null,
      }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(screen.getByText('Maps to partition')).toBeInTheDocument();
  expect(screen.getByText('event_time')).toBeInTheDocument();
  expect(screen.getByText('Default datetime column')).toBeInTheDocument();
});

test('a partition column with nothing mapped warns that queries will not prune', () => {
  // Wireframe 1g. Hiding the column from Explore without mirroring anything
  // onto it is strictly worse than no mapping, so it has to say so.
  render(
    <PartitionColumnFields
      datasource={{ main_dttm_col: null, partition_column: 'dt_epoch' }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(screen.getByText('No mapping')).toBeInTheDocument();
  expect(
    screen.getByText(/will scan every partition until a column is mapped/),
  ).toBeInTheDocument();
});

test('an active mapping states which column mirrors onto which', () => {
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      previewMirrors
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/will automatically apply an equivalent filter to/),
  ).toBeInTheDocument();
});

test('without "preserves ordering" the banner does not promise the time range', () => {
  // Range operators only mirror under an order-preserving transform, so the
  // time range -- the filter owners care about most -- gets no partition
  // filter, and the banner must say so rather than promise every filter.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      previewMirrors
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.getByText(
      /Time ranges and other range filters are not mirrored until "Transform preserves ordering" is on/,
    ),
  ).toBeInTheDocument();
});

test('with "preserves ordering" the banner promises every filter', () => {
  const orderedColumns = MAPPED_COLUMNS.map(column =>
    column.column_name === 'event_time'
      ? { ...column, partition_transform_is_monotonic: true }
      : column,
  );
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      columns={orderedColumns}
      allColumns={orderedColumns}
      onPartitionColumnChange={jest.fn()}
      previewMirrors
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/^Filters on event_time will automatically apply/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/range filters are not mirrored/),
  ).not.toBeInTheDocument();
});

test('the banner stops claiming a mirror the preview refused', () => {
  // Every check this section can make is static, and `no_such_fn(:value)`
  // clears all of them -- it parses, it has a `:value`, it is not Jinja. The
  // mapped column's own panel has already asked the database and been told no,
  // so the banner may not go on promising a speed-up the query gives up.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
      previewMirrors={false}
    />,
  );

  expect(
    screen.queryByText(/will automatically apply an equivalent filter to/),
  ).not.toBeInTheDocument();
});

test('the banner also defers to the stored mapping the engine refused', () => {
  // What an owner sees on reopening the editor: no preview has run yet this
  // session, but the backend remembers that the last probe of the stored
  // transform produced no mirror.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        // Naming the transform the verdict was about is what makes it apply:
        // it is a statement about one expression, and the box still holds it.
        partition_filter_mapping: {
          evaluable: false,
          evaluated_transform: 'unix_timestamp(:value)',
          mapped_column: 'event_time',
          partition_column: 'dt_epoch',
        },
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.queryByText(/will automatically apply an equivalent filter to/),
  ).not.toBeInTheDocument();
});

test('a mapping nothing has judged yet says so rather than promising a mirror', () => {
  // `null` is not a refusal: a preview still in flight, or a mapping no chart
  // has run, must not read as broken. It is not a pass either (SC-130302): a
  // transform that only emits NULL clears every static check, and the banner
  // promised a mirror for it until its verdict came back.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_filter_mapping: { evaluable: null },
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
      previewMirrors={null}
    />,
  );

  expect(screen.getByTestId('partition-mapping-unconfirmed')).toHaveTextContent(
    'Partition pruning on event_time has not been confirmed.',
  );
  expect(
    screen.queryByText(/will automatically apply an equivalent filter to/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/scan every partition/)).not.toBeInTheDocument();
});

test('no partition column means no "maps to partition" at all', () => {
  render(
    <PartitionColumnFields
      datasource={{ main_dttm_col: 'event_time' }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(screen.queryByText('Maps to partition')).not.toBeInTheDocument();
});

test('the override link navigates to the target column', async () => {
  const onNavigateToColumn = jest.fn();
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={onNavigateToColumn}
    />,
  );

  await userEvent.click(screen.getByText('Map a different column instead →'));

  expect(onNavigateToColumn).toHaveBeenCalledWith('event_time');
});

test('an unmapped column offers to take the mapping over', async () => {
  const onMoveMappingHere = jest.fn();
  render(
    <PartitionMappingSection
      item={{ column_name: 'country', type: 'TEXT' }}
      value={null}
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={onMoveMappingHere}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByText('Move mapping to this column →'));

  expect(onMoveMappingHere).toHaveBeenCalledWith('country');
});

test.each([
  ['an epoch column', 'BIGINT', 'epoch_s', 'A SQL expression using :value'],
  ['a timestamp column', 'TIMESTAMP', undefined, 'unix_timestamp(:value)'],
])(
  'the transform hint on %s offers the engine default only where it applies',
  (_, type, format, placeholder) => {
    // Ribbon's epoch `event_time` showed `unix_timestamp(:value)` as the hint,
    // which both Hive and Impala reject on a number.
    render(
      <PartitionMappingSection
        item={{
          column_name: 'event_time',
          type,
          is_dttm: true,
          python_date_format: format,
        }}
        value={null}
        datasource={{
          main_dttm_col: 'event_time',
          partition_column: 'dt',
          partition_value_transform_default: 'unix_timestamp(:value)',
        }}
        onMoveMappingHere={jest.fn()}
        onRemoveMapping={jest.fn()}
        onMonotonicChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('partition-value-transform')).toHaveAttribute(
      'placeholder',
      placeholder,
    );
  },
);

test('the partition column itself gets no mapping section', () => {
  const { container } = render(
    <PartitionMappingSection
      item={{ column_name: 'dt_epoch', type: 'BIGINT' }}
      value={null}
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('nothing renders when no partition column is set', () => {
  const { container } = render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value={null}
      datasource={{ main_dttm_col: 'event_time' }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('the mapped column shows the transform, the checkbox and the preview', async () => {
  fetchMock.post(PREVIEW_URL, {
    result: {
      valid: true,
      sample_input: "event_time >= '2026-01-15 00:00:00'",
      emitted_predicate: 'dt_epoch >= 1768435200',
    },
  });

  render(
    <PartitionMappingSection
      item={{
        column_name: 'event_time',
        is_dttm: true,
        partition_transform_is_monotonic: true,
      }}
      value="unix_timestamp(:value)"
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText('Value transform')).toHaveValue(
    'unix_timestamp(:value)',
  );
  expect(screen.getByText('Transform preserves ordering')).toBeInTheDocument();

  expect(await screen.findByText('dt_epoch >= 1768435200')).toBeInTheDocument();
  expect(
    screen.getByText("event_time >= '2026-01-15 00:00:00'"),
  ).toBeInTheDocument();
});

test('a failed preview shows the error instead of a predicate', async () => {
  // Annotated 1c: only one of preview and error is ever visible.
  fetchMock.post(PREVIEW_URL, {
    result: {
      valid: false,
      error:
        'The value transform could not be parsed: syntax error at position 21.',
    },
  });

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value="unix_timestamp(:value"
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(
    await screen.findByText(/syntax error at position 21/),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('partition-mapping-preview'),
  ).not.toBeInTheDocument();
});

test('only the mapped row publishes a preview verdict', async () => {
  // Every expanded column renders this component and they all report to the
  // same `onPreviewVerdict`, but only the mapped one previews anything
  // (`enabled: state === 'mapped'`) -- so the others reported a permanent
  // `null`. Expanding any other column after the mapped row's preview had
  // failed therefore reset the dataset banner to claiming filters would mirror,
  // while the mapped row went on showing the failure.
  const onPreviewVerdict = jest.fn();

  render(
    <PartitionMappingSection
      item={{ column_name: 'country' }}
      value={null}
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
      onPreviewVerdict={onPreviewVerdict}
    />,
  );

  // The row renders -- it offers to take the mapping over -- and stays silent.
  expect(
    await screen.findByText('Move mapping to this column →'),
  ).toBeInTheDocument();
  expect(onPreviewVerdict).not.toHaveBeenCalled();
});

test('a validation error with an object-valued message still renders', async () => {
  // The preview schema rejects a transform past the 1,024-character bound with
  // HTTP 400 and an *object* `message` (`{value_transform: [...]}`).
  // `getClientErrorObject` leaves that as it found it and puts the normalized
  // text in `error`, so preferring `message` handed an object to
  // `Alert description` and React threw "Objects are not valid as a React
  // child" -- the owner saw a blank panel instead of the reason.
  fetchMock.post(PREVIEW_URL, {
    status: 400,
    body: {
      message: { value_transform: ['Longer than maximum length 1024.'] },
    },
  });

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value={`lower(${' '.repeat(1100)}:value)`}
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(
    screen.queryByTestId('partition-mapping-preview'),
  ).not.toBeInTheDocument();
});

test('a stored refusal stops applying once the transform changes', () => {
  // The stored verdict is a statement about one expression, and it outlived it:
  // reopen a dataset whose `no_such_fn(:value)` failed its last probe, replace
  // it with something that works, and the banner still said nothing would
  // mirror -- because it read a summary computed when the editor opened.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_filter_mapping: {
          evaluable: false,
          evaluated_transform: 'no_such_fn(:value)',
          mapped_column: 'event_time',
          partition_column: 'dt_epoch',
        },
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  // `MAPPED_COLUMNS` holds `unix_timestamp(:value)`, not the refused text, so
  // the refusal says nothing about it -- and nothing else has judged it yet.
  expect(
    screen.getByTestId('partition-mapping-unconfirmed'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/is not mirroring filters/),
  ).not.toBeInTheDocument();
});

test('designating a partition column does not claim it is hidden from Explore', () => {
  // `handlePartitionColumnChange` deliberately leaves `filterable`/`groupby`
  // alone, so the warning telling the owner the column was hidden from Explore
  // described something that had stopped happening.
  render(
    <PartitionColumnFields
      datasource={{ main_dttm_col: null, partition_column: 'dt_epoch' }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/No filter is mirrored onto dt_epoch/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/hidden from Explore/)).not.toBeInTheDocument();
  expect(screen.queryByText(/hides it from Explore/)).not.toBeInTheDocument();
});

test('the ordering checkbox reports back which column it belongs to', async () => {
  fetchMock.post(PREVIEW_URL, { result: { valid: false } });
  const onMonotonicChange = jest.fn();

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value="unix_timestamp(:value)"
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={onMonotonicChange}
    />,
  );

  await userEvent.click(screen.getByText('Transform preserves ordering'));

  expect(onMonotonicChange).toHaveBeenCalledWith('event_time', true);
});

test('a non-temporal mapped column marks the transform required', () => {
  render(
    <PartitionMappingSection
      item={{ column_name: 'country', type: 'TEXT' }}
      value="lower(:value)"
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'region_key',
        partition_mapped_column: 'country',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/Required for non-temporal columns/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      /holds the mapping instead of the default datetime column/,
    ),
  ).toBeInTheDocument();
});

test('no preview is requested until a transform is written', async () => {
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value=""
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  await waitFor(() => {
    expect(fetchMock.callHistory.calls(PREVIEW_URL)).toHaveLength(0);
  });
});

test('removing the mapping is reported to the editor', async () => {
  fetchMock.post(PREVIEW_URL, { result: { valid: false } });
  const onRemoveMapping = jest.fn();

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value="unix_timestamp(:value)"
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={onRemoveMapping}
      onMonotonicChange={jest.fn()}
    />,
  );

  await userEvent.click(screen.getByText('Remove mapping'));

  expect(onRemoveMapping).toHaveBeenCalled();
});

/**
 * The editor's commit path in miniature: `onChange` advances the parent's state
 * inside the event (the editor's own `setDatabaseColumns`), and the same value
 * is replayed a tick later by the prop-sync effect, which re-seeds the whole
 * column array from a snapshot one render cycle old (DatasourceEditor's
 * `propsDatasource` effect, DatasourceModal's `setCurrentDatasource`). Any
 * keystroke landing inside that window is destroyed by the replay, and
 * Fieldset's itemRef then merges the next keystroke onto the reverted string --
 * which is how typing yields interleaved garbage rather than a clean prefix.
 */
function EchoingEditor({
  onCommit,
  echoDelay = 50,
}: {
  onCommit: (value: string | null) => void;
  echoDelay?: number;
}) {
  const [value, setValue] = useState('');
  return (
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value={value}
      onChange={next => {
        onCommit(next);
        setValue(next ?? '');
        const replayed = next ?? '';
        setTimeout(() => setValue(replayed), echoDelay);
      }}
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />
  );
}

test('typing a transform keeps every keystroke through the editor round trip', async () => {
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });
  const onCommit = jest.fn();

  render(<EchoingEditor onCommit={onCommit} />);
  const input = screen.getByLabelText('Value transform');

  // 40ms/char: slower than the round trip, faster than the commit debounce --
  // the rate QA reproduced the drop at.
  await userEvent.type(input, 'extract(epoch from cast(:value as timestamp))', {
    delay: 40,
  });

  expect(input).toHaveValue('extract(epoch from cast(:value as timestamp))');

  // ...and what is committed upward -- the only thing DatasourceModal saves.
  await waitFor(() => {
    expect(onCommit).toHaveBeenLastCalledWith(
      'extract(epoch from cast(:value as timestamp))',
    );
  });
  // The echo of that commit must not walk the box backwards afterwards.
  expect(input).toHaveValue('extract(epoch from cast(:value as timestamp))');
});

test('clearing a transform and retyping keeps the first character', async () => {
  // QA saw the character typed immediately after a clear disappear: clearing
  // widens the echo window, because it also resets the preview.
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });
  const onCommit = jest.fn();

  render(<EchoingEditor onCommit={onCommit} />);
  const input = screen.getByLabelText('Value transform');

  await userEvent.type(input, 'lower(:value)', { delay: 40 });
  await userEvent.clear(input);
  await userEvent.type(input, ':value', { delay: 40 });

  expect(input).toHaveValue(':value');
  await waitFor(() => {
    expect(onCommit).toHaveBeenLastCalledWith(':value');
  });
});

test('blurring the transform commits it without waiting for the debounce', async () => {
  // DatasourceModal's buildPayload reads committed state only, so the debounce
  // has to be flushed when focus leaves -- clicking Save blurs this input
  // before the click lands, and an unflushed edit would be silently dropped.
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });
  const onChange = jest.fn();

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value=""
      onChange={onChange}
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  const input = screen.getByLabelText('Value transform');
  fireEvent.change(input, { target: { value: 'unix_timestamp(:value)' } });
  expect(onChange).not.toHaveBeenCalled();

  fireEvent.blur(input);

  // Synchronous: the commit has already happened by the time Save reads state.
  expect(onChange).toHaveBeenCalledWith('unix_timestamp(:value)');
});

test('an unmapped column that takes the mapping over starts from the prop', async () => {
  // Local state must not shadow a transform arriving from outside the input --
  // "Move mapping to this column" pre-fills one, and the box has to show it.
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });

  const { rerender } = render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value=""
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText('Value transform')).toHaveValue('');

  rerender(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value="unix_timestamp(:value)"
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(screen.getByLabelText('Value transform')).toHaveValue(
    'unix_timestamp(:value)',
  );
});

test('typing Jinja into the transform says so at the field', async () => {
  // Blocking issues never reach the preview -- `transformCanPreview` declines to
  // send them -- so without a message of their own they show nothing at all,
  // and the only clue would be a disabled Save button somewhere above.
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value=":value"
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  await userEvent.clear(screen.getByLabelText('Value transform'));
  // Pasted rather than typed: userEvent reads `{{` as its own escape for a
  // literal brace, so typing this would never produce a Jinja delimiter.
  await userEvent.click(screen.getByLabelText('Value transform'));
  await userEvent.paste("unix_timestamp('{{ ds }}')");

  // As it is typed: the commit back into the editor is debounced, so a message
  // keyed off the committed value would lag the box it describes.
  expect(
    await screen.findByTestId('partition-value-transform-error'),
  ).toHaveTextContent(/Jinja templating is not supported/);
});

test('an empty transform on a non-temporal column says the field is required', () => {
  render(
    <PartitionMappingSection
      item={{ column_name: 'country', type: 'TEXT' }}
      value=""
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'region_key',
        partition_mapped_column: 'country',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(
    screen.getByTestId('partition-value-transform-error'),
  ).toHaveTextContent(/A value transform is required on country/);
});

test('an empty transform on a temporal column is inactive, not an error', () => {
  // Tier 2 on the backend, and the dataset-level warning already covers it.
  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value=""
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(
    screen.queryByTestId('partition-value-transform-error'),
  ).not.toBeInTheDocument();
});

test.each([
  'Map a different column instead →',
  'Customize the value transform →',
])('"%s" is reachable from the keyboard', async label => {
  // antd's `Typography.Link` without an `href` renders an `<a>` that is outside
  // the tab order and ignores Enter, so these actions were mouse-only.
  const onNavigateToColumn = jest.fn();
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      previewMirrors
      onNavigateToColumn={onNavigateToColumn}
    />,
  );

  const trigger = screen.getByRole('button', { name: label });
  trigger.focus();
  await userEvent.keyboard('{Enter}');

  expect(onNavigateToColumn).toHaveBeenCalledWith('event_time');
});

test('"Map a column" is reachable from the keyboard', async () => {
  const onNavigateToColumn = jest.fn();
  render(
    <PartitionColumnFields
      datasource={{ main_dttm_col: null, partition_column: 'dt_epoch' }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={onNavigateToColumn}
    />,
  );

  const trigger = screen.getByRole('button', { name: 'Map a column →' });
  trigger.focus();
  await userEvent.keyboard('{Enter}');

  expect(onNavigateToColumn).toHaveBeenCalledWith('event_time');
});

test('"Move mapping to this column" is reachable from the keyboard', async () => {
  const onMoveMappingHere = jest.fn();
  render(
    <PartitionMappingSection
      item={{ column_name: 'country', type: 'TEXT' }}
      value={null}
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={onMoveMappingHere}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  const trigger = screen.getByRole('button', {
    name: 'Move mapping to this column →',
  });
  trigger.focus();
  await userEvent.keyboard('{Enter}');

  expect(onMoveMappingHere).toHaveBeenCalledWith('country');
});

test('the override link leads somewhere when the mapping points at itself', async () => {
  // Choosing a partition column that is already the default datetime column is
  // reachable in one click, and leaves the self-mapping the backend rejects.
  // Navigating to the mapped column then opens the partition column's own row,
  // which renders no mapping section -- so the one guided way out of the broken
  // state was a dead end.
  const onNavigateToColumn = jest.fn();
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'event_time',
      }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={onNavigateToColumn}
    />,
  );

  await userEvent.click(
    screen.getByRole('button', { name: 'Map a different column instead →' }),
  );

  expect(onNavigateToColumn).not.toHaveBeenCalledWith('event_time');
  expect(onNavigateToColumn).toHaveBeenCalledWith('dt_epoch');
});

test('an unparseable-but-nonblank transform is not announced as mirroring', () => {
  // A transform with no `:value` has nothing to substitute, so the backend
  // reports the mapping inactive. The green alert claimed otherwise.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      columns={PLACEHOLDERLESS_COLUMNS}
      allColumns={PLACEHOLDERLESS_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.queryByText(/will automatically apply an equivalent filter/),
  ).not.toBeInTheDocument();
  // A transform *is* set -- `unix_timestamp(event_time)` -- it just names the
  // column where `:value` belongs, so nothing mirrors. The banner used to read
  // "No value transform is set", which sent the owner looking for an empty box.
  expect(
    screen.getByText(/The value transform on event_time is not mirroring/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/No value transform is set/),
  ).not.toBeInTheDocument();
});

test('the spinner stops when the transform stops being previewable', async () => {
  // The in-flight request's own handlers see the abort and stop short of
  // clearing `loading`, and the next effect run used to return early without
  // clearing it either -- so clearing the transform mid-request left the panel
  // spinning for good.
  let release: (value: unknown) => void = () => {};
  fetchMock.post(
    PREVIEW_URL,
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );

  const props = {
    item: { column_name: 'event_time', is_dttm: true },
    datasource: {
      id: 1,
      main_dttm_col: 'event_time',
      partition_column: 'dt_epoch',
    },
    onMoveMappingHere: jest.fn(),
    onRemoveMapping: jest.fn(),
    onMonotonicChange: jest.fn(),
  };

  const { rerender } = render(
    <PartitionMappingSection {...props} value="unix_timestamp(:value)" />,
  );

  expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();

  // The owner clears the box while the request is still out.
  rerender(<PartitionMappingSection {...props} value="" />);

  await waitFor(() => {
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  release({ body: { result: { valid: true } } });
});

test('a superseded preview response does not overwrite the current one', async () => {
  // This hits a live warehouse query, so responses can arrive out of order.
  // Without a request identity the older one wins and reports "Valid" for a
  // transform the input no longer holds.
  let releaseFirst: (value: unknown) => void = () => {};
  let call = 0;
  fetchMock.post(PREVIEW_URL, () => {
    call += 1;
    if (call === 1) {
      return new Promise(resolve => {
        releaseFirst = resolve;
      });
    }
    return {
      body: {
        result: { valid: true, emitted_predicate: 'dt_epoch = 2' },
      },
    };
  });

  const props = {
    item: { column_name: 'event_time', is_dttm: true },
    datasource: {
      id: 1,
      main_dttm_col: 'event_time',
      partition_column: 'dt_epoch',
    },
    onMoveMappingHere: jest.fn(),
    onRemoveMapping: jest.fn(),
    onMonotonicChange: jest.fn(),
  };

  const { rerender } = render(
    <PartitionMappingSection {...props} value="first(:value)" />,
  );
  await waitFor(() => {
    expect(fetchMock.callHistory.calls(PREVIEW_URL)).toHaveLength(1);
  });

  rerender(<PartitionMappingSection {...props} value="second(:value)" />);
  expect(await screen.findByText('dt_epoch = 2')).toBeInTheDocument();

  // The first request finally lands, carrying a predicate for text that is no
  // longer in the box.
  releaseFirst({
    body: { result: { valid: true, emitted_predicate: 'dt_epoch = 1' } },
  });

  await waitFor(() => {
    expect(screen.queryByText('dt_epoch = 1')).not.toBeInTheDocument();
  });
  expect(screen.getByText('dt_epoch = 2')).toBeInTheDocument();
});

test('a superseded preview failure does not overwrite the current one', async () => {
  // The identity check ran before `getClientErrorObject`, which reads the
  // response body and so awaits. The race needs the *first* request to fail
  // while it is still current -- so it passes that check -- and the second to
  // become current and resolve valid while the first is inside the await.
  // The stale error then landed on top of the valid preview, and the panel
  // reported a failure for the transform the box actually holds.
  let releaseNormalization: (value: unknown) => void = () => {};
  const held = new Promise(resolve => {
    releaseNormalization = resolve;
  });
  const normalize = getClientErrorObject as jest.Mock;
  // Cleared here as well as in `afterEach`: the count below is this test's
  // own, and every earlier test that took the error path added to it.
  normalize.mockClear();
  normalize.mockImplementationOnce(async () => {
    await held;
    return { error: 'the first transform was rejected' };
  });

  let call = 0;
  fetchMock.post(PREVIEW_URL, () => {
    call += 1;
    if (call === 1) {
      return { status: 422, body: { message: 'rejected' } };
    }
    return {
      body: { result: { valid: true, emitted_predicate: 'dt_epoch = 2' } },
    };
  });

  const props = {
    item: { column_name: 'event_time', is_dttm: true },
    datasource: {
      id: 1,
      main_dttm_col: 'event_time',
      partition_column: 'dt_epoch',
    },
    onMoveMappingHere: jest.fn(),
    onRemoveMapping: jest.fn(),
    onMonotonicChange: jest.fn(),
  };

  const { rerender } = render(
    <PartitionMappingSection {...props} value="first(:value)" />,
  );
  // The first request has failed and is parked inside the normalization.
  await waitFor(() => {
    expect(normalize).toHaveBeenCalledTimes(1);
  });

  // The second becomes current and comes back valid.
  rerender(<PartitionMappingSection {...props} value="second(:value)" />);
  expect(await screen.findByText('dt_epoch = 2')).toBeInTheDocument();

  // Only now does the first finish normalizing its error.
  releaseNormalization(undefined);

  await waitFor(() => {
    expect(
      screen.queryByText('the first transform was rejected'),
    ).not.toBeInTheDocument();
  });
  expect(screen.getByText('dt_epoch = 2')).toBeInTheDocument();
});

/**
 * Like `EchoingEditor`, but the committed value comes back *only* after the
 * delay -- no synchronous echo.
 *
 * That is the real editor's shape: a commit travels through
 * `DatasourceEditor`'s state and `onChangeInternal` before it returns as a
 * prop, so the round trip can finish after the owner has typed more.
 */
function LateEchoingEditor({
  onCommit,
  echoDelay = 80,
}: {
  onCommit: (value: string | null) => void;
  echoDelay?: number;
}) {
  const [value, setValue] = useState('');
  return (
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      value={value}
      onChange={next => {
        onCommit(next);
        const replayed = next ?? '';
        setTimeout(() => setValue(replayed), echoDelay);
      }}
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
      }}
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />
  );
}

test('a commit landing mid-typing does not revert the keystrokes after it', async () => {
  // Enter flushes the pending commit immediately, so the echo can arrive while
  // the owner is still typing -- the one case the debounce does not cover. The
  // re-seed cannot tell an echo from a genuine external value, so without a
  // record of what was just committed it reset the input to the committed text
  // and dropped everything typed since.
  fetchMock.post(PREVIEW_URL, { result: { valid: true } });
  const onCommit = jest.fn();

  render(<LateEchoingEditor onCommit={onCommit} echoDelay={80} />);
  const input = screen.getByLabelText('Value transform');

  await userEvent.type(input, 'lower(:value');
  await userEvent.keyboard('{Enter}');
  // Keep typing across the echo's arrival: 20ms/char against an 80ms echo, so
  // the committed value lands back as a prop with later characters already in
  // the box.
  await userEvent.type(input, ') -- x', { delay: 20 });

  await waitFor(() => {
    expect(input).toHaveValue('lower(:value) -- x');
  });
});

test('a calculated mapped column is not reported as missing', () => {
  // The backend builds its column set from every column on the dataset, so a
  // calculated column is a valid mapped-column override and both PUT and
  // import accept one. Validating against the physical columns alone called it
  // missing -- a blocking error, and an inescapable one, because the
  // partition-column dropdown is physical-only and the mapping picker does not
  // render on a calculated column's row. Reopening such a dataset and changing
  // nothing but its description left Save permanently disabled.
  const calculated = {
    column_name: 'event_day',
    type: 'TEXT',
    expression: 'date(event_time)',
    partition_value_transform: 'unix_timestamp(:value)',
  };

  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: 'event_day',
      }}
      columns={COLUMNS}
      allColumns={[...COLUMNS, calculated]}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.queryByText(/is not a column on this dataset/),
  ).not.toBeInTheDocument();
});

test('a mapped column that really is absent is still reported', () => {
  // The counterweight: widening the validation set must not stop it noticing a
  // mapped column that is genuinely gone, which is what happens when a column
  // payload drops the column the mapping pointed at.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: 'long_gone',
      }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/long_gone is not a column on this dataset/),
  ).toBeInTheDocument();
});

test('a self-mapping the owner can save through reads as a warning', () => {
  // The implicit self-mapping -- no override, and `main_dttm_col` happens to
  // equal the partition column -- is non-blocking on purpose, on both sides:
  // a dataset already in that state has to stay editable. Danger styling on a
  // message beside an enabled Save button said the opposite of what the button
  // was doing.
  const { rerender } = render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'dt_epoch',
        partition_column: 'dt_epoch',
        partition_mapped_column: null,
      }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  const implicit = screen.getByTestId('partition-column-error');
  expect(implicit).toHaveTextContent(/mapped onto itself/);
  expect(implicit).toHaveClass('ant-typography-warning');

  // The explicit one is something the owner asked for and can take back, so it
  // blocks the save and keeps the error styling.
  rerender(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_mapped_column: 'dt_epoch',
      }}
      columns={COLUMNS}
      allColumns={COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  const explicit = screen.getByTestId('partition-column-error');
  expect(explicit).toHaveTextContent(/mapped onto itself/);
  expect(explicit).toHaveClass('ant-typography-danger');
});

test('a mapping onto an unsaved column says so instead of previewing', async () => {
  // The endpoint belongs to the *saved* dataset and resolves the column names
  // against its persisted columns, while the editor validates against its
  // unsaved state. Syncing a column from source and mapping onto it before
  // saving therefore had the editor accept it while the preview reported that
  // the column does not exist -- a valid candidate shown as broken.
  fetchMock.post(PREVIEW_URL, {
    body: { result: { valid: true, emitted_predicate: 'dt_epoch = 1' } },
  });

  render(
    <PartitionMappingSection
      item={{ column_name: 'synced_at', is_dttm: true }}
      datasource={{
        id: 1,
        main_dttm_col: 'synced_at',
        partition_column: 'dt_epoch',
        // `synced_at` is not among them: it has been synced from source but
        // not saved.
        columns: [{ column_name: 'event_time' }, { column_name: 'dt_epoch' }],
      }}
      value="unix_timestamp(:value)"
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(
    await screen.findByText(/Save the dataset to preview/),
  ).toBeInTheDocument();
  // Said rather than asked: no request is made *for this column*. Asserted on
  // the body rather than on an empty history, because a neighbouring test's
  // 500ms debounce can still land in this window under a full-directory run.
  expect(
    fetchMock.callHistory
      .calls(PREVIEW_URL)
      .map(call => String(call.options?.body ?? ''))
      .filter(body => body.includes('synced_at')),
  ).toHaveLength(0);
  // And it is a warning, not an error: nothing is wrong with the mapping.
  expect(screen.getByText('Not previewed yet')).toBeInTheDocument();
});

test('a mapping onto saved columns still previews', async () => {
  // The other half: supplying the column list must not suppress the ordinary
  // case.
  fetchMock.post(PREVIEW_URL, {
    body: { result: { valid: true, emitted_predicate: 'dt_epoch = 1' } },
  });

  render(
    <PartitionMappingSection
      item={{ column_name: 'event_time', is_dttm: true }}
      datasource={{
        id: 1,
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        columns: [{ column_name: 'event_time' }, { column_name: 'dt_epoch' }],
      }}
      value="unix_timestamp(:value)"
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
    />,
  );

  expect(await screen.findByText('dt_epoch = 1')).toBeInTheDocument();
});

test('the unsaved notice is not reported as a failed verdict', async () => {
  // `unsaved` is not a verdict -- the preview has not asked. Reporting `false`
  // would have the dataset banner claim nothing mirrors on the strength of a
  // question nobody answered.
  const onPreviewVerdict = jest.fn();
  fetchMock.post(PREVIEW_URL, {
    body: { result: { valid: true, emitted_predicate: 'dt_epoch = 1' } },
  });

  render(
    <PartitionMappingSection
      item={{ column_name: 'synced_at', is_dttm: true }}
      datasource={{
        id: 1,
        main_dttm_col: 'synced_at',
        partition_column: 'dt_epoch',
        columns: [{ column_name: 'dt_epoch' }],
      }}
      value="unix_timestamp(:value)"
      onMoveMappingHere={jest.fn()}
      onRemoveMapping={jest.fn()}
      onMonotonicChange={jest.fn()}
      onPreviewVerdict={onPreviewVerdict}
    />,
  );

  expect(
    await screen.findByText(/Save the dataset to preview/),
  ).toBeInTheDocument();
  expect(onPreviewVerdict).not.toHaveBeenCalledWith(false);
});

test('a stored pass about another partition column is not a confirmation', () => {
  // The stored verdict is keyed on the transform text alone, so after the
  // partition column is re-pointed it still reads as a pass -- for a mirror
  // onto a column nobody has checked it against.
  render(
    <PartitionColumnFields
      datasource={{
        main_dttm_col: 'event_time',
        partition_column: 'dt_epoch',
        partition_filter_mapping: {
          evaluable: true,
          evaluated_transform: 'unix_timestamp(:value)',
          mapped_column: 'event_time',
          partition_column: 'dt_other',
        },
      }}
      columns={MAPPED_COLUMNS}
      allColumns={MAPPED_COLUMNS}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.getByTestId('partition-mapping-unconfirmed'),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/will automatically apply an equivalent filter to/),
  ).not.toBeInTheDocument();
});
