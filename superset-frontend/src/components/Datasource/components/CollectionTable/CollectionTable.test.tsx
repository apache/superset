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
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';

import mockDatasource from 'spec/fixtures/mockDatasource';
import TextControl from 'src/explore/components/controls/TextControl';
import Field from '../Field';
import Fieldset from '../Fieldset';
import CollectionTable from '.';

const props = {
  collection: mockDatasource['7__table'].columns,
  tableColumns: ['column_name', 'type', 'groupby'],
  sortColumns: [],
};

test('keeps tie order stable when pagination reapplies a descending sort', () => {
  const collection = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    column_name: `col_${i + 1}`,
    verbose_name: '',
  }));

  const { container } = render(
    <CollectionTable
      collection={collection}
      tableColumns={['column_name', 'verbose_name']}
      sortColumns={['verbose_name']}
      pagination={{ pageSize: 25 }}
    />,
  );

  // Only verbose_name is sortable, so it is the sole sorter.
  const sorter = container.querySelector('.ant-table-column-sorters')!;
  // ascend -> descend on the all-blank verbose_name column.
  fireEvent.click(sorter);
  fireEvent.click(sorter);

  const pageRows = () =>
    Array.from(container.querySelectorAll('.ant-table-tbody tr')).map(
      row => row.textContent,
    );
  const first = pageRows();
  expect(first).toHaveLength(25);

  fireEvent.click(container.querySelector('.ant-pagination-item-2')!);
  const second = pageRows();
  expect(second).toHaveLength(5);

  expect(new Set([...first, ...second]).size).toBe(30);
});

test('keeps a row added while sorted after the sort is cleared', () => {
  const initial = [
    { id: 1, column_name: 'c_col' },
    { id: 2, column_name: 'a_col' },
  ];

  const Parent = () => {
    const [collection, setCollection] = useState(initial);
    return (
      <CollectionTable
        collection={collection}
        tableColumns={['column_name']}
        sortColumns={['column_name']}
        allowAddItem
        itemGenerator={() => ({ id: 3, column_name: 'new_col' })}
        onChange={items => setCollection(items as typeof initial)}
      />
    );
  };

  const { container, getByTestId } = render(<Parent />);
  const sorter = container.querySelector('.ant-table-column-sorters');

  fireEvent.click(sorter!);
  fireEvent.click(getByTestId('add-item-button'));
  // ascend -> descend -> cancel
  fireEvent.click(sorter!);
  fireEvent.click(sorter!);

  const rows = container.querySelectorAll('.ant-table-tbody tr');
  expect(rows).toHaveLength(3);
  expect(
    Array.from(rows).some(row => row.textContent?.includes('new_col')),
  ).toBe(true);
});

test('renders a table', () => {
  const { container } = render(<CollectionTable {...props} />);
  const tableBody = container.querySelector('.ant-table-tbody');
  expect(tableBody).toBeInTheDocument();
  const rows = tableBody?.getElementsByTagName('tr');
  expect(rows).toHaveLength(mockDatasource['7__table'].columns.length);
});

test('preserves an edit made while sorted after the sort is cleared', () => {
  const onChange = jest.fn();
  const collection = [
    { id: 1, column_name: 'b_col', type: 'VARCHAR' },
    { id: 2, column_name: 'a_col', type: 'VARCHAR' },
  ];

  const { container } = render(
    <CollectionTable
      collection={collection}
      tableColumns={['column_name', 'type']}
      sortColumns={['column_name']}
      itemRenderers={{
        type: (val, onItemChange, _label, record) => (
          <input
            data-test={`type-input-${record.id}`}
            value={val as string}
            onChange={e => onItemChange(e.target.value)}
          />
        ),
      }}
      onChange={onChange}
    />,
  );

  const sorter = container.querySelector('.ant-table-column-sorters');
  expect(sorter).toBeInTheDocument();

  // Ascending sort by column_name puts a_col (id 2) first.
  fireEvent.click(sorter!);

  const editedInput = container.querySelector(
    '[data-test="type-input-2"]',
  ) as HTMLInputElement;
  expect(editedInput).toBeInTheDocument();
  fireEvent.change(editedInput, { target: { value: 'EDITED' } });

  // Descending sort puts b_col (id 1) first and a_col (id 2) second; the
  // edit must still be displayed on the active-sort rows.
  fireEvent.click(sorter!);
  const rowsDescending = container.querySelectorAll('.ant-table-tbody tr');
  expect(rowsDescending[0].textContent).toContain('b_col');
  expect(rowsDescending[1].textContent).toContain('a_col');
  expect(
    (container.querySelector('[data-test="type-input-2"]') as HTMLInputElement)
      .value,
  ).toBe('EDITED');

  // Cycle the sort back to unsorted (descend -> cancel).
  fireEvent.click(sorter!);

  const inputAfterReset = container.querySelector(
    '[data-test="type-input-2"]',
  ) as HTMLInputElement;
  expect(inputAfterReset.value).toBe('EDITED');
});

test('restores the synced order after a sort is cleared following an external reorder', () => {
  const collection = [
    { id: 1, column_name: 'c_col', type: 'VARCHAR' },
    { id: 2, column_name: 'a_col', type: 'VARCHAR' },
    { id: 3, column_name: 'b_col', type: 'VARCHAR' },
  ];

  const { container, rerender } = render(
    <CollectionTable
      collection={collection}
      tableColumns={['column_name', 'type']}
      sortColumns={['column_name']}
    />,
  );

  const sorter = container.querySelector('.ant-table-column-sorters');
  expect(sorter).toBeInTheDocument();

  // Ascending sort by column_name.
  fireEvent.click(sorter!);

  // Simulate an external sync (e.g. the source columns were reordered)
  // landing while sorted: same ids, new canonical order.
  const syncedCollection = [
    { id: 3, column_name: 'b_col', type: 'VARCHAR' },
    { id: 1, column_name: 'c_col', type: 'VARCHAR' },
    { id: 2, column_name: 'a_col', type: 'VARCHAR' },
  ];
  rerender(
    <CollectionTable
      collection={syncedCollection}
      tableColumns={['column_name', 'type']}
      sortColumns={['column_name']}
    />,
  );

  // Cycle the sort back to unsorted (ascend -> descend -> cancel).
  fireEvent.click(sorter!);
  fireEvent.click(sorter!);

  const rows = container.querySelectorAll('.ant-table-tbody tr');
  expect(rows).toHaveLength(3);
  // The restored order reflects the synced order, not the stale
  // pre-sync order captured before the sort was ever applied.
  expect(rows[0].textContent).toContain('b_col');
  expect(rows[1].textContent).toContain('c_col');
  expect(rows[2].textContent).toContain('a_col');
});

test('restores the original order after a sort is cleared when the parent echoes onChange back', () => {
  const initial = [
    { id: 1, column_name: 'c_col', type: 'VARCHAR' },
    { id: 2, column_name: 'a_col', type: 'VARCHAR' },
    { id: 3, column_name: 'b_col', type: 'VARCHAR' },
  ];

  const Parent = () => {
    const [collection, setCollection] = useState(initial);
    return (
      <CollectionTable
        collection={collection}
        tableColumns={['column_name', 'type']}
        sortColumns={['column_name']}
        itemRenderers={{
          type: (val, onItemChange, _label, record) => (
            <input
              data-test={`type-input-${record.id}`}
              value={val as string}
              onChange={e => onItemChange(e.target.value)}
            />
          ),
        }}
        onChange={items => setCollection(items as typeof initial)}
      />
    );
  };

  const { container } = render(<Parent />);
  const sorter = container.querySelector('.ant-table-column-sorters');
  expect(sorter).toBeInTheDocument();

  // Ascending sort, then edit a row so the parent echoes the sorted array.
  fireEvent.click(sorter!);
  const input = container.querySelector(
    '[data-test="type-input-2"]',
  ) as HTMLInputElement;
  expect(input).toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'EDITED' } });

  // ascend -> descend -> cancel
  fireEvent.click(sorter!);
  fireEvent.click(sorter!);

  const rows = container.querySelectorAll('.ant-table-tbody tr');
  expect(rows).toHaveLength(3);
  expect(rows[0].textContent).toContain('c_col');
  expect(rows[1].textContent).toContain('a_col');
  expect(rows[2].textContent).toContain('b_col');
  expect(
    (container.querySelector('[data-test="type-input-2"]') as HTMLInputElement)
      .value,
  ).toBe('EDITED');
});

test("a delayed fieldset commit does not revert another row's edit", async () => {
  // Each expanded row renders its own `Fieldset`, and the value-transform
  // input commits on a debounce -- so the collection a closure captured at the
  // keystroke is older than the real one by the time the timer fires. Written
  // back as an absolute value, that snapshot reverted whatever a *different*
  // row had committed in between, and one of the two edits was silently lost
  // on save.
  const onChange = jest.fn();
  const collection = [
    { id: 'a', column_name: 'a', description: '' },
    { id: 'b', column_name: 'b', description: '' },
  ];

  render(
    <CollectionTable
      collection={collection}
      tableColumns={['column_name']}
      sortColumns={[]}
      expandFieldset={
        <Fieldset compact>
          <Field
            fieldKey="description"
            label="Description"
            control={<TextControl />}
          />
        </Fieldset>
      }
      onChange={onChange}
    />,
  );

  const expanders = screen.getAllByRole('button', { name: /expand row/i });
  await userEvent.click(expanders[0]);
  await userEvent.click(expanders[1]);

  const inputs = screen.getAllByRole('textbox');
  expect(inputs).toHaveLength(2);

  // Both rows edited before either commit is observed by the other.
  fireEvent.change(inputs[0], { target: { value: 'from A' } });
  fireEvent.change(inputs[1], { target: { value: 'from B' } });

  await waitFor(() => expect(onChange).toHaveBeenCalled());

  const final = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  const byId = Object.fromEntries(
    final.map((item: { id: string; description?: string }) => [
      item.id,
      item.description,
    ]),
  );
  expect(byId.a).toBe('from A');
  expect(byId.b).toBe('from B');
});

test('a fieldset commit reaches the keyed collection a cleared sort reads', async () => {
  // `onSortChange` restores the pre-sort order from `collection[id]`, so a
  // fieldset commit that updated only the array would resurface as a stale row
  // the moment the sort is cleared. Both structures have to move together.
  const onChange = jest.fn();
  const collection = [
    { id: 1, column_name: 'b_col', description: '' },
    { id: 2, column_name: 'a_col', description: '' },
  ];

  const { container } = render(
    <CollectionTable
      collection={collection}
      tableColumns={['column_name']}
      sortColumns={['column_name']}
      expandFieldset={
        <Fieldset compact>
          <Field
            fieldKey="description"
            label="Description"
            control={<TextControl />}
          />
        </Fieldset>
      }
      onChange={onChange}
    />,
  );

  await userEvent.click(
    screen.getAllByRole('button', { name: /expand row/i })[0],
  );
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'edited' },
  });
  await waitFor(() => expect(onChange).toHaveBeenCalled());

  // Sort, then clear the sort.
  const header = container.querySelector('th.ant-table-column-has-sorters');
  await userEvent.click(header!);
  await userEvent.click(header!);
  await userEvent.click(header!);

  const final = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  const edited = final.find((item: { id: number }) => item.id === 1);
  expect(edited?.description).toBe('edited');
});

test('applies rowClassName to each row', () => {
  // The dataset editor mutes the partition column's row this way; without the
  // prop reaching the table the class was never applied and the styling in
  // `StyledColumnsTableWrapper` was dead.
  const { container } = render(
    <CollectionTable
      {...props}
      rowClassName={record =>
        record.column_name === 'num_boys' ? 'partition-column-row' : ''
      }
    />,
  );

  const tagged = container.querySelectorAll('tr.partition-column-row');
  expect(tagged).toHaveLength(1);
  expect(tagged[0]).toHaveTextContent('num_boys');
});

test('expands the row a reveal request points at', () => {
  // A link elsewhere in the editor asks for a column by name; the row has to
  // open on its own, with nothing for the user to click.
  render(
    <CollectionTable
      {...props}
      expandFieldset={<Fieldset compact>{null}</Fieldset>}
      expandItemWhere={record => record.column_name === 'num_boys'}
      expandItemNonce={1}
    />,
  );

  expect(screen.getByLabelText('Collapse row')).toBeInTheDocument();
});

test('re-opens a revealed row the user collapsed, on a second request', () => {
  // The request is an event, not a state: asking for the same column twice
  // has to work, which is what the nonce carries. Without it a bare name
  // would make the second ask a no-op and the row would stay shut.
  const Harness = () => {
    const [nonce, setNonce] = useState(1);
    return (
      <>
        <button type="button" onClick={() => setNonce(n => n + 1)}>
          reveal again
        </button>
        <CollectionTable
          {...props}
          expandFieldset={<Fieldset compact>{null}</Fieldset>}
          expandItemWhere={record => record.column_name === 'num_boys'}
          expandItemNonce={nonce}
        />
      </>
    );
  };

  render(<Harness />);

  fireEvent.click(screen.getByLabelText('Collapse row'));
  expect(screen.queryByLabelText('Collapse row')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'reveal again' }));

  expect(screen.getByLabelText('Collapse row')).toBeInTheDocument();
});

test('a collection change does not reopen a revealed row the user collapsed', () => {
  // The reveal is keyed on the nonce alone, and the collection is replaced
  // wholesale on every cell edit, delete, add and props sync. An effect that
  // depended on it re-asserted the expansion afterwards, so the row reopened
  // on the user's next change to any row -- the opposite of the additive
  // behaviour the prop documents.
  const Harness = () => {
    const [collection, setCollection] = useState(props.collection);
    return (
      <>
        <button
          type="button"
          onClick={() =>
            setCollection(items =>
              items.map(item => ({ ...item, verbose_name: 'edited' })),
            )
          }
        >
          edit a row
        </button>
        <CollectionTable
          {...props}
          collection={collection}
          expandFieldset={<Fieldset compact>{null}</Fieldset>}
          expandItemWhere={record => record.column_name === 'num_boys'}
          expandItemNonce={1}
        />
      </>
    );
  };

  render(<Harness />);

  fireEvent.click(screen.getByLabelText('Collapse row'));
  expect(screen.queryByLabelText('Collapse row')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'edit a row' }));

  expect(screen.queryByLabelText('Collapse row')).not.toBeInTheDocument();
});

test('a reveal request leaves rows the user opened open', () => {
  // Expansion is additive, so revealing one row must not close another.
  const Harness = () => {
    const [nonce, setNonce] = useState<number | undefined>(undefined);
    return (
      <>
        <button type="button" onClick={() => setNonce(1)}>
          reveal
        </button>
        <CollectionTable
          {...props}
          expandFieldset={<Fieldset compact>{null}</Fieldset>}
          expandItemWhere={record => record.column_name === 'num_boys'}
          expandItemNonce={nonce}
        />
      </>
    );
  };

  render(<Harness />);

  fireEvent.click(screen.getAllByLabelText('Expand row')[0]);
  expect(screen.getAllByLabelText('Collapse row')).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'reveal' }));

  expect(screen.getAllByLabelText('Collapse row')).toHaveLength(2);
});
