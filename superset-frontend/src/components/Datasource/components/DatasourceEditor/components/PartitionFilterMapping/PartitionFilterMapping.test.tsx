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
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import PartitionColumnFields from './PartitionColumnFields';
import PartitionMappingSection from './PartitionMappingSection';

const COLUMNS = [
  { column_name: 'event_time', type: 'TIMESTAMP', is_dttm: true },
  { column_name: 'dt_epoch', type: 'BIGINT' },
  { column_name: 'country', type: 'TEXT' },
];

const PREVIEW_URL = 'glob:*/api/v1/dataset/1/partition_mapping/preview/';

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
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
      columns={COLUMNS.map(column =>
        column.column_name === 'event_time'
          ? { ...column, partition_value_transform: 'unix_timestamp(:value)' }
          : column,
      )}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.getByText(/will automatically apply an equivalent filter to/),
  ).toBeInTheDocument();
});

test('no partition column means no "maps to partition" at all', () => {
  render(
    <PartitionColumnFields
      datasource={{ main_dttm_col: 'event_time' }}
      columns={COLUMNS}
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
      columns={COLUMNS.map(column =>
        column.column_name === 'event_time'
          ? { ...column, partition_value_transform: 'unix_timestamp(:value)' }
          : column,
      )}
      onPartitionColumnChange={jest.fn()}
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
      columns={COLUMNS.map(column =>
        column.column_name === 'event_time'
          ? {
              ...column,
              partition_value_transform: 'unix_timestamp(event_time)',
            }
          : column,
      )}
      onPartitionColumnChange={jest.fn()}
      onNavigateToColumn={jest.fn()}
    />,
  );

  expect(
    screen.queryByText(/will automatically apply an equivalent filter/),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/No value transform is set/)).toBeInTheDocument();
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
