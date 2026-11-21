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

import { act, render, fireEvent, waitFor } from 'spec/helpers/testing-library';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import RunQueryActionButton, {
  RunQueryActionButtonProps,
} from 'src/SqlLab/components/RunQueryActionButton';

import {
  pointerEvent,
  mouseClick,
  keyDown,
  keyUp,
} from 'spec/helpers/runStopButton';

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

test('pending checks use the existing Stop button without extra controls', () => {
  const runQuery = jest.fn();
  const stopQuery = jest.fn();
  const { getByRole, queryByRole } = setup(
    { queryState: 'pending', runQuery, stopQuery },
    mockStore(initialState),
  );
  const stop = getByRole('button', { name: /Stop$/ });
  expect(stop).toBeEnabled();
  expect(queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  fireEvent.click(stop);
  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).toHaveBeenCalledTimes(1);
});

test('confirmation disables Run without adding extra toolbar labels', () => {
  const { getByRole } = setup(
    { awaitingConfirmation: true },
    mockStore(initialState),
  );
  expect(getByRole('button', { name: /Run$/ })).toBeDisabled();
});

test('Stop still stops an already running query', () => {
  const stopQuery = jest.fn();
  const { getByRole } = setup(
    { queryState: 'running', stopQuery },
    mockStore(initialState),
  );
  fireEvent.click(getByRole('button', { name: /Stop$/ }));
  expect(stopQuery).toHaveBeenCalledTimes(1);
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

  pointerEvent('pointerdown', button);
  fireEvent.mouseDown(button);
  switchTo('success');
  expect(getByText('Run')).toBeInTheDocument();
  pointerEvent('pointerup', button);
  fireEvent.mouseUp(button);
  pointerEvent('click', button);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a Space key press that starts on Stop does not run the query after it finishes', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');

  keyDown(button, ' ');
  switchTo('success');
  keyDown(button, ' ', true);
  keyUp(button, ' ');

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a pointer gesture that starts on Stop does not run the query with the CTAS dropdown', () => {
  const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton({
    overlayCreateAsMenu: ctasMenu,
  });
  const mainButton = getAllByRole('button')[0];

  pointerEvent('pointerdown', mainButton);
  switchTo('success');
  pointerEvent('click', mainButton);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a pointer gesture that starts and ends on Stop stops the query', () => {
  const { getByRole, runQuery, stopQuery } = renderGestureButton({});
  const button = getByRole('button');

  pointerEvent('pointerdown', button);
  pointerEvent('click', button);

  expect(stopQuery).toHaveBeenCalledTimes(1);
  expect(runQuery).not.toHaveBeenCalled();
});

test('a new gesture after the query finishes runs the query', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');

  pointerEvent('pointerdown', button);
  switchTo('success');
  pointerEvent('click', button);
  pointerEvent('pointerdown', button);
  pointerEvent('click', button);

  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

const expectHeldEnterNotToRun = (props: Partial<RunQueryActionButtonProps>) => {
  const { getAllByRole, runQuery, stopQuery, switchTo } =
    renderGestureButton(props);
  const button = getAllByRole('button')[0];

  // Native buttons click on every Enter keydown, including auto-repeat.
  keyDown(button, 'Enter');
  expect(stopQuery).toHaveBeenCalledTimes(1);
  switchTo('success');
  for (let repeat = 0; repeat < 2; repeat += 1) {
    keyDown(button, 'Enter', true);
  }
  fireEvent.keyUp(button, { key: 'Enter', code: 'Enter' });

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).toHaveBeenCalledTimes(1);

  keyDown(button, 'Enter');
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
  keyDown(button, ' ');
  keyDown(button, ' ', true);
  switchTo('success');
  keyDown(button, ' ', true);
  keyUp(button, ' ');

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a Run gesture does not stop a newly running query', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  switchTo('success');
  const button = getByRole('button');

  pointerEvent('pointerdown', button);
  switchTo('running');
  pointerEvent('click', button);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test('an assistive technology click still runs after a CTAS caret key press', () => {
  const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton({
    overlayCreateAsMenu: ctasMenu,
  });
  const [mainButton, caretButton] = getAllByRole('button');

  keyDown(caretButton, 'Enter');
  fireEvent.keyUp(caretButton, { key: 'Enter', code: 'Enter' });
  switchTo('success');
  // Assistive technology can activate the main button without a new press.
  fireEvent.click(mainButton, { detail: 0 });

  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('an assistive technology click still runs after a CTAS caret pointer press', () => {
  const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton({
    overlayCreateAsMenu: ctasMenu,
  });
  const [mainButton, caretButton] = getAllByRole('button');

  pointerEvent('pointerdown', caretButton);
  pointerEvent('pointerup', caretButton);
  pointerEvent('click', caretButton);
  switchTo('success');
  fireEvent.click(mainButton, { detail: 0 });

  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

test.each(['plain', 'CTAS'])(
  'an assistive technology click still runs after a cancelled %s main-button pointer press',
  async variant => {
    const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton(
      {
        overlayCreateAsMenu: variant === 'CTAS' ? ctasMenu : null,
      },
    );
    const button = getAllByRole('button')[0];

    pointerEvent('pointerdown', button);
    switchTo('success');
    // Releasing outside the button does not produce a button click.
    pointerEvent('pointerup', document.body);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    fireEvent.click(button, { detail: 0 });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(stopQuery).not.toHaveBeenCalled();
  },
);

test.each(['Escape', 'blur', 'keyup'])(
  'an assistive technology click still runs after a Space press cancelled by %s',
  async cancellation => {
    const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton(
      {},
    );
    const button = getByRole('button');

    keyDown(button, ' ');
    if (cancellation === 'Escape') {
      fireEvent.keyDown(button, { key: 'Escape', code: 'Escape' });
    } else if (cancellation === 'blur') {
      fireEvent.blur(button);
    }
    if (cancellation === 'keyup') {
      // A release on another element has no native button default click.
      fireEvent.keyUp(document.body, { key: ' ', code: 'Space' });
      await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    }
    switchTo('success');
    fireEvent.click(button, { detail: 0 });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(stopQuery).not.toHaveBeenCalled();
  },
);

test.each(['pointerCancel', 'lostPointerCapture'])(
  'an assistive technology click still runs after main-button %s',
  async cancellation => {
    const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton(
      {},
    );
    const button = getByRole('button');

    pointerEvent('pointerdown', button);
    fireEvent[cancellation as 'pointerCancel' | 'lostPointerCapture'](button);
    switchTo('success');
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    fireEvent.click(button, { detail: 0 });

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(stopQuery).not.toHaveBeenCalled();
  },
);

test('moving focus during a pointer press preserves the starting Stop action', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');

  pointerEvent('pointerdown', button);
  fireEvent.blur(button);
  switchTo('success');
  pointerEvent('pointerup', button);
  pointerEvent('lostpointercapture', button);
  pointerEvent('click', button);

  expect(runQuery).not.toHaveBeenCalled();
  expect(stopQuery).not.toHaveBeenCalled();
});

test.each(['mouse', 'touch', 'pen'])(
  'a delayed %s Stop click retains intent after release, capture loss and timers',
  async pointerType => {
    const {
      getByRole,
      runQuery: run,
      stopQuery: stop,
      switchTo,
    } = renderGestureButton({});
    const button = getByRole('button');
    const finish = () => switchTo('success');
    pointerEvent('pointerdown', button, 7, pointerType);
    finish();
    pointerEvent('pointerup', button, 7, pointerType);
    pointerEvent('lostpointercapture', button, 7, pointerType);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    pointerEvent('click', button, 7, pointerType);
    expect(run).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    // An unmatched activation must not inherit this (consumed) pointer intent.
    fireEvent.click(button, { detail: 0 });
    expect(run).toHaveBeenCalledTimes(1);
  },
);

test('Space on Stop followed by Escape and release never runs after completion', () => {
  const {
    getByRole,
    runQuery: run,
    stopQuery: stop,
    switchTo,
  } = renderGestureButton({});
  const button = getByRole('button');
  const finish = () => switchTo('success');
  keyDown(button, ' ');
  finish();
  keyDown(button, 'Escape');
  keyUp(button, 'Escape');
  keyUp(button, ' ');
  expect(run).not.toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
  fireEvent.click(button, { detail: 0 });
  expect(run).toHaveBeenCalledTimes(1);
});

test.each(['second pointer', 'unrelated key'])(
  'a held Stop pointer ignores release of a %s',
  async unrelated => {
    const {
      getByRole,
      runQuery: run,
      stopQuery: stop,
      switchTo,
    } = renderGestureButton({});
    const button = getByRole('button');
    const finish = () => switchTo('success');
    pointerEvent('pointerdown', button, 7, 'touch');
    finish();
    if (unrelated === 'second pointer') {
      pointerEvent('pointerup', document.body, 8, 'touch');
      pointerEvent('lostpointercapture', document.body, 8, 'touch');
      pointerEvent('pointercancel', document.body, 8, 'touch');
    } else {
      fireEvent.keyUp(document.body, { key: 'Enter' });
      fireEvent.keyUp(document.body, { key: ' ' });
    }
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    pointerEvent('pointerup', button, 7, 'touch');
    pointerEvent('click', button, 7, 'touch');
    expect(run).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
  },
);

test('held Enter on Run does not run again after completion until a fresh press', () => {
  const {
    getByRole,
    runQuery: run,
    stopQuery: stop,
    switchTo,
  } = renderGestureButton({});
  const button = getByRole('button');
  const finish = () => switchTo('success');
  finish();
  keyDown(button, 'Enter');
  expect(run).toHaveBeenCalledTimes(1);
  switchTo('running');
  finish();
  keyDown(button, 'Enter', true);
  keyDown(button, 'Enter', true);
  keyUp(button, 'Enter');
  expect(run).toHaveBeenCalledTimes(1);
  expect(stop).not.toHaveBeenCalled();
  keyDown(button, 'Enter');
  keyUp(button, 'Enter');
  expect(run).toHaveBeenCalledTimes(2);
});

test.each(['pointer', 'keyboard'])(
  'an independent click during a pending %s press uses the displayed action',
  async source => {
    const {
      getByRole,
      runQuery: run,
      stopQuery: stop,
      switchTo,
    } = renderGestureButton({});
    const button = getByRole('button');
    const finish = () => switchTo('success');
    if (source === 'pointer') pointerEvent('pointerdown', button, 7, 'touch');
    else keyDown(button, ' ');
    finish();
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    fireEvent.click(button, { detail: 0 });
    expect(run).toHaveBeenCalledTimes(1);
    if (source === 'pointer') {
      pointerEvent('pointerup', button, 7, 'touch');
      pointerEvent('click', button, 7, 'touch');
    } else keyUp(button, ' ');
    expect(run).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  },
);

test('a held Space press ignores a different key or target releasing', async () => {
  const {
    getByRole,
    runQuery: run,
    stopQuery: stop,
    switchTo,
  } = renderGestureButton({});
  const button = getByRole('button');
  const finish = () => switchTo('success');
  keyDown(button, ' ');
  finish();
  fireEvent.keyUp(button, { key: 'Enter' });
  fireEvent.keyUp(document.body, { key: ' ' });
  await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  keyUp(button, ' ');
  expect(run).not.toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
});

test.each([
  ['mouse', 'plain'],
  ['touch', 'plain'],
  ['mouse', 'CTAS'],
  ['touch', 'CTAS'],
])(
  'a %s Stop press on the %s button cannot run after completion via a plain MouseEvent click',
  async (pointerType, variant) => {
    const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton(
      {
        overlayCreateAsMenu: variant === 'CTAS' ? ctasMenu : null,
      },
    );
    const button = getAllByRole('button')[0];
    pointerEvent('pointerdown', button, 7, pointerType);
    switchTo('success');
    pointerEvent('pointerup', button, 7, pointerType);
    pointerEvent('lostpointercapture', button, 7, pointerType);
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    mouseClick(button);

    expect(runQuery).not.toHaveBeenCalled();
    expect(stopQuery).not.toHaveBeenCalled();
    // The MouseEvent must consume the pointer entry, not poison a later click.
    pointerEvent('click', button, 7, pointerType);
    expect(runQuery).toHaveBeenCalledTimes(1);
    fireEvent.click(button, { detail: 0 });
    expect(runQuery).toHaveBeenCalledTimes(2);
  },
);

test.each(['plain', 'CTAS'])(
  'a plain MouseEvent click consumes matching Stop intent on the %s button',
  variant => {
    const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton(
      {
        overlayCreateAsMenu: variant === 'CTAS' ? ctasMenu : null,
      },
    );
    const button = getAllByRole('button')[0];
    pointerEvent('pointerdown', button, 7, 'touch');
    pointerEvent('pointerup', button, 7, 'touch');
    mouseClick(button);
    expect(stopQuery).toHaveBeenCalledTimes(1);

    switchTo('success');
    pointerEvent('click', button, 7, 'touch');
    expect(runQuery).toHaveBeenCalledTimes(1);
    mouseClick(button);
    expect(runQuery).toHaveBeenCalledTimes(2);
  },
);

test.each(['plain', 'CTAS'])(
  'a plain MouseEvent click matches the released pointer, not another held press on the %s button',
  variant => {
    const { getAllByRole, runQuery, stopQuery, switchTo } = renderGestureButton(
      {
        overlayCreateAsMenu: variant === 'CTAS' ? ctasMenu : null,
      },
    );
    const button = getAllByRole('button')[0];
    pointerEvent('pointerdown', button, 7, 'touch');
    switchTo('success');
    // A second pointer may press Run while the Stop pointer remains held.
    pointerEvent('pointerdown', button, 8, 'touch');
    pointerEvent('pointerup', button, 8, 'touch');
    mouseClick(button);
    expect(runQuery).toHaveBeenCalledTimes(1);

    pointerEvent('pointerup', button, 7, 'touch');
    mouseClick(button);
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(stopQuery).not.toHaveBeenCalled();
  },
);

test('plain clicks consume multiple touch releases in release order', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');
  const finishQuery = () => switchTo('success');
  pointerEvent('pointerdown', button, 7, 'touch');
  finishQuery();
  pointerEvent('pointerdown', button, 8, 'touch');
  pointerEvent('pointerup', button, 7, 'touch');
  pointerEvent('pointerup', button, 8, 'touch');
  mouseClick(button);
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('a plain Run click without a preceding press runs once', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');
  const finishQuery = () => switchTo('success');
  finishQuery();
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('three Run press and plain click cycles run three times', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');
  const finishQuery = () => switchTo('success');
  finishQuery();
  for (let cycle = 0; cycle < 3; cycle += 1) {
    pointerEvent('pointerdown', button, 7, 'touch');
    pointerEvent('pointerup', button, 7, 'touch');
    mouseClick(button);
  }
  expect(runQuery).toHaveBeenCalledTimes(3);
  expect(stopQuery).not.toHaveBeenCalled();
});

test('detail-zero clicks bypass the queue of released Stop presses', () => {
  const { getByRole, runQuery, stopQuery, switchTo } = renderGestureButton({});
  const button = getByRole('button');
  const finishQuery = () => switchTo('success');
  pointerEvent('pointerdown', button, 7, 'touch');
  finishQuery();
  pointerEvent('pointerup', button, 7, 'touch');
  fireEvent.click(button, { detail: 0 });
  expect(runQuery).toHaveBeenCalledTimes(1);
  mouseClick(button);
  expect(runQuery).toHaveBeenCalledTimes(1);
  expect(stopQuery).not.toHaveBeenCalled();
});
