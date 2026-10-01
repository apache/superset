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
import { fireEvent, render } from 'spec/helpers/testing-library';

import mockDatasource from 'spec/fixtures/mockDatasource';
import CollectionTable from '.';

const props = {
  collection: mockDatasource['7__table'].columns,
  tableColumns: ['column_name', 'type', 'groupby'],
  sortColumns: [],
};

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

  // Cycle the sort back to unsorted (ascend -> descend -> cancel).
  fireEvent.click(sorter!);
  fireEvent.click(sorter!);

  const inputAfterReset = container.querySelector(
    '[data-test="type-input-2"]',
  ) as HTMLInputElement;
  expect(inputAfterReset.value).toBe('EDITED');
});
