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

test('renders a table', () => {
  const { container } = render(<CollectionTable {...props} />);
  const tableBody = container.querySelector('.ant-table-tbody');
  expect(tableBody).toBeInTheDocument();
  const rows = tableBody?.getElementsByTagName('tr');
  expect(rows).toHaveLength(mockDatasource['7__table'].columns.length);
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

test('a fieldset commit preserves the collection order', () => {
  // The previous implementation rebuilt the array in two passes to keep order;
  // the functional updater maps in place, which has to do the same.
  const onChange = jest.fn();
  const collection = [
    { id: 'z', column_name: 'z', description: '' },
    { id: 'a', column_name: 'a', description: '' },
  ];

  const { container } = render(
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

  const rows = container.querySelectorAll('.ant-table-tbody tr');
  expect(rows).toHaveLength(2);
});
