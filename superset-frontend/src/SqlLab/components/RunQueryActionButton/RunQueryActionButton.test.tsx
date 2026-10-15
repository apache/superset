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
import { Store } from 'redux';
import { supersetTheme } from '@apache-superset/core/theme';
import { Menu } from '@superset-ui/core/components/Menu';

import { render, fireEvent, waitFor } from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import RunQueryActionButton, {
  RunQueryActionButtonProps,
} from 'src/SqlLab/components/RunQueryActionButton';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

jest.mock('@superset-ui/core/components/Select/Select', () => () => (
  <div data-test="mock-deprecated-select-select" />
));
jest.mock('@superset-ui/core/components/Select/AsyncSelect', () => () => (
  <div data-test="mock-deprecated-async-select" />
));

const defaultProps = {
  queryEditorId: defaultQueryEditor.id,
  dbId: 1,
  queryState: 'ready',
  runQuery: () => {},
  selectedText: null,
  stopQuery: () => {},
  overlayCreateAsMenu: null,
};

const setup = (props?: Partial<RunQueryActionButtonProps>, store?: Store) =>
  render(<RunQueryActionButton {...defaultProps} {...props} />, {
    useRedux: true,
    ...(store && { store }),
  });

test('renders a single Button', () => {
  const { getByRole } = setup({}, mockStore(initialState));
  expect(getByRole('button')).toBeInTheDocument();
});

test('renders a label for Run Query', () => {
  const { getByText } = setup({}, mockStore(initialState));
  expect(getByText('Run')).toBeInTheDocument();
});

test('renders a label for Selected Query', () => {
  const { getByText } = setup(
    {},
    mockStore({
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        unsavedQueryEditor: {
          id: defaultQueryEditor.id,
          selectedText: 'select * from\n-- this is comment\nwhere',
        },
      },
    }),
  );
  expect(getByText('Run selection')).toBeInTheDocument();
});

test('disable button when sql from unsaved changes is empty', () => {
  const { getByRole } = setup(
    {},
    mockStore({
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        unsavedQueryEditor: {
          id: defaultQueryEditor.id,
          sql: '',
        },
      },
    }),
  );
  const button = getByRole('button');
  expect(button).toBeDisabled();
});

test('disable button when selectedText only contains blank contents', () => {
  const { getByRole } = setup(
    {},
    mockStore({
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        unsavedQueryEditor: {
          id: defaultQueryEditor.id,
          selectedText: '-- this is comment\n\n     \t',
        },
      },
    }),
  );
  const button = getByRole('button');
  expect(button).toBeDisabled();
});

test('enable default button for unrelated unsaved changes', () => {
  const { getByRole } = setup(
    {},
    mockStore({
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        unsavedQueryEditor: {
          id: `${defaultQueryEditor.id}-other`,
          sql: '',
        },
      },
    }),
  );
  const button = getByRole('button');
  expect(button).toBeEnabled();
});

test('dispatch runQuery on click', async () => {
  const runQuery = jest.fn();
  const { getByRole } = setup({ runQuery }, mockStore(initialState));
  const button = getByRole('button');
  expect(runQuery).toHaveBeenCalledTimes(0);
  fireEvent.click(button);
  await waitFor(() => expect(runQuery).toHaveBeenCalledTimes(1));
});

test('dispatch stopQuery on click while running state', async () => {
  const stopQuery = jest.fn();
  const { getByRole } = setup(
    { queryState: 'running', stopQuery },
    mockStore(initialState),
  );
  const button = getByRole('button');
  expect(stopQuery).toHaveBeenCalledTimes(0);
  fireEvent.click(button);
  await waitFor(() => expect(stopQuery).toHaveBeenCalledTimes(1));
});

const ctasMenu = <Menu items={[{ key: 'table', label: 'CREATE TABLE AS' }]} />;

test('opening the CTAS/CVAS dropdown menu does not crash and shows the menu', async () => {
  const { getAllByRole, findByText } = setup(
    { overlayCreateAsMenu: ctasMenu },
    mockStore(initialState),
  );
  const buttons = getAllByRole('button');
  const caretButton = buttons[buttons.length - 1];
  fireEvent.click(caretButton);
  expect(await findByText('CREATE TABLE AS')).toBeInTheDocument();
});

test('renders the caret icon with a color that contrasts with the primary button background', () => {
  const { container } = setup(
    { overlayCreateAsMenu: ctasMenu },
    mockStore(initialState),
  );
  const caretIcon = container.querySelector('[data-test="down"]');
  expect(caretIcon).toHaveStyle({ color: supersetTheme.colorTextLightSolid });
});

const renderGestureButton = (props: Partial<RunQueryActionButtonProps>) => {
  const runQuery = jest.fn();
  const stopQuery = jest.fn();
  const store = mockStore(initialState);
  const element = (queryState: string) => (
    <RunQueryActionButton
      {...defaultProps}
      {...props}
      queryState={queryState}
      runQuery={runQuery}
      stopQuery={stopQuery}
    />
  );
  const utils = render(element('running'), { useRedux: true, store });
  const switchTo = (queryState: string) => utils.rerender(element(queryState));
  return { ...utils, runQuery, stopQuery, switchTo };
};

test('a pointer gesture that starts on Stop does not run the query after it finishes', () => {
  const { getByRole, getByText, runQuery, stopQuery, switchTo } =
    renderGestureButton({});
  const button = getByRole('button');
  expect(getByText('Stop')).toBeInTheDocument();

  fireEvent.pointerDown(button);
  fireEvent.mouseDown(button);
  switchTo('success');
  expect(getByText('Run')).toBeInTheDocument();
  fireEvent.pointerUp(button);
  fireEvent.mouseUp(button);
  fireEvent.click(button);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a Space key press that starts on Stop does not run the query after it finishes', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');

  fireEvent.keyDown(button, { key: ' ', code: 'Space' });
  switchTo('success');
  fireEvent.keyDown(button, { key: ' ', code: 'Space', repeat: true });
  fireEvent.keyUp(button, { key: ' ', code: 'Space' });
  fireEvent.click(button);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a pointer gesture that starts on Stop does not run the query with the CTAS dropdown', () => {
  const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton({
    overlayCreateAsMenu: ctasMenu,
  });
  const mainButton = getAllByRole('button')[0];

  fireEvent.pointerDown(mainButton);
  switchTo('success');
  fireEvent.click(mainButton);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a pointer gesture that starts and ends on Stop stops the query', () => {
  const { getByRole, runQuery, stopQuery } = renderGestureButton({});
  const button = getByRole('button');

  fireEvent.pointerDown(button);
  fireEvent.click(button);

  expect(stopQuery).toHaveBeenCalledTimes(1);
  expect(runQuery).not.toHaveBeenCalled();
});

test('a new gesture after the query finishes runs the query', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');

  fireEvent.pointerDown(button);
  switchTo('success');
  fireEvent.click(button);
  fireEvent.pointerDown(button);
  fireEvent.click(button);

  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

const expectHeldEnterNotToRun = (props: Partial<RunQueryActionButtonProps>) => {
  const { getAllByRole, runQuery, stopQuery, switchTo } =
    renderGestureButton(props);
  const button = getAllByRole('button')[0];

  // Native buttons click on every Enter keydown, including auto-repeat.
  fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
  fireEvent.click(button, { detail: 0 });
  expect(stopQuery).toHaveBeenCalledTimes(1);
  switchTo('success');
  for (let repeat = 0; repeat < 2; repeat += 1) {
    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter', repeat: true });
    fireEvent.click(button, { detail: 0 });
  }
  fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
  fireEvent.click(button, { detail: 0 });
  fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });
  expect(runQuery).toHaveBeenCalledTimes(1);
};

test('held Enter on Stop does not run SQL after completion', () => {
  expectHeldEnterNotToRun({});
});

test('held Enter on the CTAS Stop button does not run SQL after completion', () => {
  expectHeldEnterNotToRun({ overlayCreateAsMenu: ctasMenu });
});

test('held Space on the CTAS Stop button does not run SQL after completion', () => {
  const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton({
    overlayCreateAsMenu: ctasMenu,
  });
  const button = getAllByRole('button')[0];

  // Space repeats keydown but clicks only when the key is released.
  fireEvent.keyDown(button, { key: ' ', code: 'Space' });
  fireEvent.keyDown(button, { key: ' ', code: 'Space', repeat: true });
  switchTo('success');
  fireEvent.keyDown(button, { key: ' ', code: 'Space', repeat: true });
  fireEvent.keyUp(button, { key: ' ', code: 'Space' });
  fireEvent.click(button, { detail: 0 });

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a Run gesture does not stop a newly running query', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  switchTo('success');
  const button = getByRole('button');

  fireEvent.pointerDown(button);
  switchTo('running');
  fireEvent.click(button);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});
