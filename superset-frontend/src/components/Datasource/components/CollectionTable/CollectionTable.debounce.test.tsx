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
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from 'spec/helpers/testing-library';
import { Constants } from '@superset-ui/core/components';
import TextControl from 'src/explore/components/controls/TextControl';
import TextAreaControl from 'src/explore/components/controls/TextAreaControl';
import Field from '../Field';
import Fieldset from '../Fieldset';
import CollectionTable from '.';

const initialRows = [
  { id: 1, column_name: 'first', description: '', verbose_name: '' },
  { id: 2, column_name: 'second', description: '', verbose_name: '' },
];

const tableProps = {
  collection: initialRows,
  tableColumns: ['column_name', 'description', 'verbose_name'],
  sortColumns: ['column_name'],
  allowAddItem: true,
  allowDeletes: true,
  itemGenerator: () => ({
    id: 3,
    column_name: 'added',
    description: '',
    verbose_name: '',
  }),
  expandFieldset: (
    <Fieldset>
      <Field
        fieldKey="description"
        label="Description"
        control={<TextControl placeholder="Description" />}
      />
      <Field
        fieldKey="verbose_name"
        label="Label"
        control={<TextControl placeholder="Label" />}
      />
    </Fieldset>
  ),
};

/** Commits pending text edits together, as controls can do within one render. */
function flushEdits() {
  act(() => jest.advanceTimersByTime(Constants.FAST_DEBOUNCE));
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a pending expanded-row edit preserves an added row and its order', () => {
  const onChange = jest.fn();
  render(<CollectionTable {...tableProps} onChange={onChange} />);
  fireEvent.click(screen.getAllByRole('button', { name: /expand row/i })[0]);
  fireEvent.change(screen.getByPlaceholderText('Description'), {
    target: { value: 'edited' },
  });
  fireEvent.click(screen.getByRole('button', { name: /add item/i }));
  flushEdits();

  expect(screen.getByText('added')).toBeVisible();
  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({ id: 3 }),
    expect.objectContaining({ id: 1, description: 'edited' }),
    expect.objectContaining({ id: 2 }),
  ]);
});

test('a pending expanded-row edit does not restore another deleted row', () => {
  const onChange = jest.fn();
  render(<CollectionTable {...tableProps} onChange={onChange} />);
  fireEvent.click(screen.getAllByRole('button', { name: /expand row/i })[0]);
  fireEvent.change(screen.getByPlaceholderText('Description'), {
    target: { value: 'edited' },
  });
  const deletedRow = screen.getByRole('row', { name: /second/i });
  fireEvent.click(
    within(deletedRow).getByRole('button', {
      name: /delete item/i,
    }),
  );
  flushEdits();

  expect(screen.queryByText('second')).not.toBeInTheDocument();
  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({ id: 1, description: 'edited' }),
  ]);
});

test('pending sibling fields and rows all survive one debounce batch', () => {
  const onChange = jest.fn();
  render(<CollectionTable {...tableProps} onChange={onChange} />);
  screen
    .getAllByRole('button', { name: /expand row/i })
    .forEach(button => fireEvent.click(button));
  fireEvent.change(screen.getAllByPlaceholderText('Description')[0], {
    target: { value: 'first description' },
  });
  fireEvent.change(screen.getAllByPlaceholderText('Label')[0], {
    target: { value: 'first label' },
  });
  fireEvent.change(screen.getAllByPlaceholderText('Description')[1], {
    target: { value: 'second description' },
  });
  flushEdits();

  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({
      id: 1,
      description: 'first description',
      verbose_name: 'first label',
    }),
    expect.objectContaining({ id: 2, description: 'second description' }),
  ]);
});

test('a pending edit preserves externally refreshed values, membership and order', () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <CollectionTable {...tableProps} onChange={onChange} />,
  );
  fireEvent.click(screen.getAllByRole('button', { name: /expand row/i })[0]);
  fireEvent.change(screen.getByPlaceholderText('Description'), {
    target: { value: 'edited' },
  });
  const refreshed = [
    { id: 4, column_name: 'external', description: '', verbose_name: '' },
    { ...initialRows[0], verbose_name: 'refreshed label' },
  ];
  onChange.mockClear();
  rerender(
    <CollectionTable
      {...tableProps}
      collection={refreshed}
      onChange={onChange}
    />,
  );
  expect(onChange).not.toHaveBeenCalled();
  flushEdits();

  expect(screen.getByText('external')).toBeVisible();
  expect(screen.queryByText('second')).not.toBeInTheDocument();
  expect(onChange).toHaveBeenLastCalledWith([
    expect.objectContaining({ id: 4 }),
    expect.objectContaining({
      id: 1,
      description: 'edited',
      verbose_name: 'refreshed label',
    }),
  ]);
});

test('an asynchronous field callback cannot resurrect the row it edited', () => {
  let pendingChange: (() => void) | undefined;
  /** Models a control whose asynchronous edit can finish after it unmounts. */
  function AsyncControl({ onChange }: { onChange?: (value: string) => void }) {
    return (
      <button
        type="button"
        onClick={() => {
          pendingChange = () => onChange?.('late edit');
        }}
      >
        Queue edit
      </button>
    );
  }
  const onChange = jest.fn();
  render(
    <CollectionTable
      {...tableProps}
      onChange={onChange}
      expandFieldset={
        <Fieldset>
          <Field
            fieldKey="description"
            label="Description"
            control={<AsyncControl />}
          />
        </Fieldset>
      }
    />,
  );
  fireEvent.click(screen.getAllByRole('button', { name: /expand row/i })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Queue edit' }));
  const deletedRow = screen.getByRole('row', { name: /first/i });
  fireEvent.click(
    within(deletedRow).getByRole('button', {
      name: /delete item/i,
    }),
  );
  onChange.mockClear();
  act(() => pendingChange?.());

  expect(screen.queryByText('first')).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test.each([
  'expand another row',
  'add a row',
  'receive a fresh collection array',
] as const)(
  'a pending SQL expression survives when you %s before its debounce fires',
  async action => {
    const onChange = jest.fn();
    const sqlProps = {
      ...tableProps,
      onChange,
      expandFieldset: (
        <Fieldset>
          <Field
            fieldKey="expression"
            label="SQL expression"
            control={
              <TextAreaControl
                language="sql"
                offerEditInModal={false}
                debounceDelay={300}
              />
            }
          />
        </Fieldset>
      ),
    };
    const { container, rerender } = render(<CollectionTable {...sqlProps} />);
    fireEvent.click(
      within(screen.getByRole('row', { name: /first/i })).getByRole('button', {
        name: /expand row/i,
      }),
    );
    await waitFor(() =>
      expect(container.querySelector('.ace_editor')).toBeInTheDocument(),
    );
    // Ace exposes its live editor on the container; setValue fires the same
    // change event as typing, without relying on jsdom's text layout.
    const editor = container.querySelector<
      HTMLElement & { env: { editor: { setValue: (value: string) => void } } }
    >('.ace_editor');
    act(() => editor?.env.editor.setValue('num + 1'));
    expect(onChange).not.toHaveBeenCalled();

    if (action === 'expand another row') {
      fireEvent.click(
        within(screen.getByRole('row', { name: /second/i })).getByRole(
          'button',
          { name: /expand row/i },
        ),
      );
    } else if (action === 'add a row') {
      fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    } else {
      rerender(<CollectionTable {...sqlProps} collection={[...initialRows]} />);
    }
    act(() => jest.advanceTimersByTime(300));

    expect(onChange).toHaveBeenLastCalledWith([
      ...(action === 'add a row' ? [expect.objectContaining({ id: 3 })] : []),
      expect.objectContaining({ id: 1, expression: 'num + 1' }),
      expect.objectContaining({ id: 2 }),
    ]);
  },
);
