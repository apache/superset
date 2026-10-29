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
  waitFor,
} from 'spec/helpers/testing-library';
import CanvasToolbar, { type CanvasToolbarProps } from './CanvasToolbar';

const history = {
  canUndo: false,
  canRedo: false,
  undo: jest.fn(),
  redo: jest.fn(),
  busy: false,
};

const actions = {
  publish: jest.fn().mockResolvedValue(undefined),
  discard: jest.fn().mockResolvedValue(undefined),
  busy: false,
};

beforeEach(() => jest.clearAllMocks());

const renderToolbar = (props: Partial<CanvasToolbarProps> = {}) =>
  render(
    <CanvasToolbar
      canEdit
      draftToken="tok-123"
      unpublished={false}
      onEnter={jest.fn()}
      saving={false}
      history={history}
      actions={actions}
      {...props}
    />,
    { useRedux: true },
  );

const modeSwitch = () => screen.getByRole('switch');

test('the switch says whether the canvas is being edited', () => {
  renderToolbar();

  expect(modeSwitch()).toBeChecked();
  // The label names what the switch turns on, so it stands either way.
  expect(screen.getByText('Draft mode')).toBeInTheDocument();
});

test('a published canvas has the switch off', () => {
  renderToolbar({ draftToken: undefined });

  expect(modeSwitch()).not.toBeChecked();
  expect(screen.getByText('Draft mode')).toBeInTheDocument();
});

test('a published canvas offers the draft, and nothing to do to it', () => {
  // Undo, redo, publish and discard all act on a draft. With none open they
  // would be a row of dead buttons.
  renderToolbar({ draftToken: undefined });

  expect(
    screen.queryByRole('button', { name: 'Undo' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Redo' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Publish/ }),
  ).not.toBeInTheDocument();
});

test('someone who may not edit gets no switch at all', () => {
  renderToolbar({ canEdit: false });

  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});

test('starting a draft is what the draft side of the switch does', () => {
  const onEnter = jest.fn();
  renderToolbar({ draftToken: undefined, onEnter });

  fireEvent.click(modeSwitch());

  expect(onEnter).toHaveBeenCalled();
});

test('undo and redo follow what the draft says is available', () => {
  renderToolbar({ history: { ...history, canUndo: true } });

  const undo = screen.getByRole('button', { name: 'Undo' });
  expect(undo).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();

  fireEvent.click(undo);

  expect(history.undo).toHaveBeenCalled();
});

test('stepping is held while a layout change is still saving', () => {
  // An undo replays the draft from its op log; a drop still in flight is not
  // in that log yet, so stepping now would rebuild a draft without it and
  // then have the write land on top.
  renderToolbar({ saving: true, history: { ...history, canUndo: true } });

  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('publishing is held while a layout change is still saving', () => {
  renderToolbar({ saving: true });

  const publish = screen.getByRole('button', { name: /Publish/ });
  expect(publish).toBeDisabled();

  fireEvent.click(publish);

  // Committing now would publish the revision before that change landed and
  // then delete the draft, losing it.
  expect(actions.publish).not.toHaveBeenCalled();
});

test('discarding is held while a layout change is still saving', () => {
  // A discard landing between a save's read and its write-back would delete
  // the draft and then have it recreated by that save, so the token still
  // opens changes the user was told were discarded.
  renderToolbar({ saving: true });

  const discard = screen.getByRole('button', { name: 'Discard' });
  expect(discard).toBeDisabled();

  fireEvent.click(discard);

  expect(actions.discard).not.toHaveBeenCalled();
});

test('the keyboard steps the draft too', () => {
  renderToolbar({ history: { ...history, canUndo: true, canRedo: true } });

  fireEvent.keyDown(document, { key: 'z', code: 'KeyZ', ctrlKey: true });
  expect(history.undo).toHaveBeenCalled();

  fireEvent.keyDown(document, {
    key: 'z',
    code: 'KeyZ',
    ctrlKey: true,
    shiftKey: true,
  });
  expect(history.redo).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(document, { key: 'y', code: 'KeyY', ctrlKey: true });
  expect(history.redo).toHaveBeenCalledTimes(2);
});

test('the shortcut does nothing on a published canvas', () => {
  // There is no draft to step, and the browser's own undo should keep it.
  renderToolbar({
    draftToken: undefined,
    history: { ...history, canUndo: true },
  });

  fireEvent.keyDown(document, { key: 'z', code: 'KeyZ', metaKey: true });

  expect(history.undo).not.toHaveBeenCalled();
});

test('the shortcut leaves text fields alone', () => {
  renderToolbar({ history: { ...history, canUndo: true } });
  const field = document.createElement('input');
  document.body.appendChild(field);

  fireEvent.keyDown(field, { key: 'z', code: 'KeyZ', metaKey: true });

  // In a widget title, Cmd+Z belongs to the title.
  expect(history.undo).not.toHaveBeenCalled();
  field.remove();
});

test('leaving a draft that holds changes asks first', async () => {
  renderToolbar({ unpublished: true });

  fireEvent.click(modeSwitch());

  // The draft is the only copy of those changes, and the eye is one click
  // away from the hand.
  expect(await screen.findByText('Leave draft mode?')).toBeInTheDocument();
  expect(actions.discard).not.toHaveBeenCalled();
});

test('a draft with nothing in it is left without ceremony', () => {
  renderToolbar({ unpublished: false });

  fireEvent.click(modeSwitch());

  expect(screen.queryByText('Leave draft mode?')).not.toBeInTheDocument();
  expect(actions.discard).toHaveBeenCalled();
});

test('the unpublished dot marks a draft that has been written to', () => {
  const { rerender } = renderToolbar({ unpublished: true });

  expect(screen.getByTestId('canvas-unpublished')).toBeInTheDocument();

  rerender(
    <CanvasToolbar
      canEdit
      draftToken="tok-123"
      unpublished={false}
      onEnter={jest.fn()}
      saving={false}
      history={history}
      actions={actions}
    />,
  );

  expect(screen.queryByTestId('canvas-unpublished')).not.toBeInTheDocument();
});

test('either answer to the modal ends the draft', async () => {
  const { rerender } = renderToolbar({ unpublished: true });

  fireEvent.click(modeSwitch());
  fireEvent.click(
    await screen.findByRole('button', { name: 'Publish and leave' }),
  );

  await waitFor(() => expect(actions.publish).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByText('Leave draft mode?')).not.toBeInTheDocument(),
  );

  rerender(
    <CanvasToolbar
      canEdit
      draftToken="tok-123"
      unpublished
      onEnter={jest.fn()}
      saving={false}
      history={history}
      actions={actions}
    />,
  );

  fireEvent.click(modeSwitch());
  fireEvent.click(
    await screen.findByRole('button', { name: 'Discard and leave' }),
  );

  await waitFor(() => expect(actions.discard).toHaveBeenCalled());
});
