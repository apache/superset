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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import {
  fireEvent,
  screen,
  render,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { QueryEditor } from 'src/SqlLab/types';
import {
  initialState,
  defaultQueryEditor,
  extraQueryEditor1,
  extraQueryEditor2,
} from 'src/SqlLab/fixtures';
import { Store } from 'redux';
import {
  REMOVE_QUERY_EDITOR,
  QUERY_EDITOR_SET_TITLE,
  ADD_QUERY_EDITOR,
} from 'src/SqlLab/actions/sqlLab';
import SqlEditorTabHeader from 'src/SqlLab/components/SqlEditorTabHeader';

jest.mock('@superset-ui/core/components/Select/Select', () => () => (
  <div data-test="mock-deprecated-select-select" />
));
jest.mock('@superset-ui/core/components/Select/AsyncSelect', () => () => (
  <div data-test="mock-async-select" />
));

const middlewares = [thunk];
const mockStore = configureStore(middlewares);
const setup = (queryEditor: QueryEditor, store?: Store) =>
  render(<SqlEditorTabHeader queryEditor={queryEditor} />, {
    useRedux: true,
    ...(store && { store }),
  });

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('SqlEditorTabHeader', () => {
  test('renders name', () => {
    const { queryByText } = setup(defaultQueryEditor, mockStore(initialState));
    expect(queryByText(defaultQueryEditor.name)).toBeInTheDocument();
    expect(queryByText(extraQueryEditor1.name)).not.toBeInTheDocument();
    expect(queryByText(extraQueryEditor2.name)).not.toBeInTheDocument();
  });

  test('renders name from unsaved changes', () => {
    const expectedTitle = 'updated title';
    const { queryByText } = setup(
      defaultQueryEditor,
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: defaultQueryEditor.id,
            name: expectedTitle,
          },
        },
      }),
    );
    expect(queryByText(expectedTitle)).toBeInTheDocument();
    expect(queryByText(defaultQueryEditor.name)).not.toBeInTheDocument();
    expect(queryByText(extraQueryEditor1.name)).not.toBeInTheDocument();
    expect(queryByText(extraQueryEditor2.name)).not.toBeInTheDocument();
  });

  test('renders current name for unrelated unsaved changes', () => {
    const unrelatedTitle = 'updated title';
    const { queryByText } = setup(
      defaultQueryEditor,
      mockStore({
        ...initialState,
        sqlLab: {
          ...initialState.sqlLab,
          unsavedQueryEditor: {
            id: `${defaultQueryEditor.id}-other`,
            name: unrelatedTitle,
          },
        },
      }),
    );
    expect(queryByText(defaultQueryEditor.name)).toBeInTheDocument();
    expect(queryByText(unrelatedTitle)).not.toBeInTheDocument();
    expect(queryByText(extraQueryEditor1.name)).not.toBeInTheDocument();
    expect(queryByText(extraQueryEditor2.name)).not.toBeInTheDocument();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('with dropdown menus', () => {
    let store = mockStore();
    beforeEach(async () => {
      store = mockStore(initialState);
      const { getByTestId } = setup(defaultQueryEditor, store);
      const dropdown = getByTestId('dropdown-trigger');

      userEvent.click(dropdown);
    });

    test('should dispatch removeQueryEditor action', async () => {
      await waitFor(() =>
        expect(screen.getByTestId('close-tab-menu-option')).toBeInTheDocument(),
      );

      fireEvent.click(screen.getByTestId('close-tab-menu-option'));

      const actions = store.getActions();
      await waitFor(() =>
        expect(actions[0]).toEqual({
          type: REMOVE_QUERY_EDITOR,
          queryEditor: defaultQueryEditor,
        }),
      );
    });

    test('should dispatch queryEditorSetTitle action', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      const expectedTitle = 'typed text';
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      fireEvent.change(input, { target: { value: expectedTitle } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      const actions = store.getActions();
      await waitFor(() =>
        expect(actions[0]).toEqual({
          type: QUERY_EDITOR_SET_TITLE,
          name: expectedTitle,
          queryEditor: expect.objectContaining({
            id: defaultQueryEditor.id,
          }),
        }),
      );
    });

    test('prefills the rename input with the current tab name', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      expect(input).toHaveValue(defaultQueryEditor.name);
    });

    test('focuses the rename input when the modal opens', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      await waitFor(() => expect(input).toHaveFocus());
    });

    test('disables Save when the input is empty or whitespace', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      fireEvent.change(input, { target: { value: '   ' } });
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    test('does not dispatch or dismiss on Enter when the input is empty', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter', keyCode: 13, charCode: 13 });

      const dispatchedTitleChange = store
        .getActions()
        .some(action => action.type === QUERY_EDITOR_SET_TITLE);
      expect(dispatchedTitleChange).toBe(false);
      // the modal must stay open so the user can correct the name,
      // mirroring the disabled Save button rather than dismissing like Escape
      expect(screen.queryByRole('dialog')).toBeInTheDocument();
    });

    test('does not dispatch a title change when the modal is cancelled', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      fireEvent.change(input, { target: { value: 'discarded text' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(store.getActions()).toEqual([]);
    });

    test('does not dispatch a title change when dismissed with the close button', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      fireEvent.change(input, { target: { value: 'discarded text' } });
      fireEvent.click(screen.getByTestId('close-modal-btn'));

      expect(store.getActions()).toEqual([]);
    });

    test('returns focus to the tab header after the modal is cancelled', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      await screen.findByTestId('rename-tab-input');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() =>
        expect(screen.getByTestId('sql-editor-tab-header')).toHaveFocus(),
      );
    });

    test('returns focus to the tab header after a successful rename', async () => {
      await waitFor(() =>
        expect(
          screen.getByTestId('rename-tab-menu-option'),
        ).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('rename-tab-menu-option'));

      const input = await screen.findByTestId('rename-tab-input');
      fireEvent.change(input, { target: { value: 'renamed tab' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(screen.getByTestId('sql-editor-tab-header')).toHaveFocus(),
      );
    });

    test('should dispatch removeAllOtherQueryEditors action', async () => {
      await waitFor(() =>
        expect(screen.getByTestId('close-tab-menu-option')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('close-all-other-menu-option'));

      const actions = store.getActions();
      await waitFor(() =>
        expect(actions).toEqual([
          {
            type: REMOVE_QUERY_EDITOR,
            queryEditor: initialState.sqlLab.queryEditors[1],
          },
          {
            type: REMOVE_QUERY_EDITOR,
            queryEditor: initialState.sqlLab.queryEditors[2],
          },
        ]),
      );
    });

    test('should dispatch cloneQueryToNewTab action', async () => {
      await waitFor(() =>
        expect(screen.getByTestId('close-tab-menu-option')).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByTestId('clone-tab-menu-option'));

      const actions = store.getActions();
      await waitFor(() =>
        expect(actions[0]).toEqual({
          type: ADD_QUERY_EDITOR,
          queryEditor: expect.objectContaining({
            name: `Copy of ${defaultQueryEditor.name}`,
            sql: defaultQueryEditor.sql,
            autorun: false,
          }),
        }),
      );
    });
  });

  test('does not leak tab-editing keystrokes from the rename input to the surrounding tabs', async () => {
    const onContainerKeyDown = jest.fn();
    const store = mockStore(initialState);
    render(
      <div onKeyDown={onContainerKeyDown}>
        <SqlEditorTabHeader queryEditor={defaultQueryEditor} />
      </div>,
      { useRedux: true, store },
    );

    userEvent.click(screen.getByTestId('dropdown-trigger'));
    await waitFor(() =>
      expect(screen.getByTestId('rename-tab-menu-option')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId('rename-tab-menu-option'));
    const input = await screen.findByTestId('rename-tab-input');

    // The modal portals over the editable-card tabs, whose keyboard handler would
    // otherwise remove, navigate, or activate a tab (and swallow Space). None of
    // these keys should escape the modal to the surrounding container.
    [
      'Delete',
      'Backspace',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
      ' ',
    ].forEach(key => fireEvent.keyDown(input, { key }));
    expect(onContainerKeyDown).not.toHaveBeenCalled();

    // Escape (close) and Tab (focus trap) must still reach the Modal.
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'Escape' });
    const reached = onContainerKeyDown.mock.calls.map(call => call[0].key);
    expect(reached).toEqual(expect.arrayContaining(['Tab', 'Escape']));
  });
});
