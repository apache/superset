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
import { fireEvent, render, screen } from 'spec/helpers/testing-library';
import { chat } from 'src/core';
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

const onEnter = jest.fn();

beforeEach(() => jest.clearAllMocks());

const renderToolbar = (props: Partial<CanvasToolbarProps> = {}) =>
  render(
    <CanvasToolbar
      canEdit
      draftToken="tok-123"
      onEnter={onEnter}
      saving={false}
      history={history}
      actions={actions}
      {...props}
    />,
    { useRedux: true },
  );

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

const editButton = () => screen.queryByRole('button', { name: 'Edit canvas' });

test('a canvas you may edit offers a way in', () => {
  renderToolbar({ draftToken: undefined });

  fireEvent.click(editButton() as HTMLElement);

  expect(onEnter).toHaveBeenCalled();
});

test('the way in goes once it has been taken', () => {
  // Editing is left from the banner, with Save or Discard. A second control
  // for it in the header would be a third answer to the same question.
  renderToolbar();

  expect(editButton()).not.toBeInTheDocument();
});

test('someone who may not edit is not offered the way in', () => {
  renderToolbar({ canEdit: false, draftToken: undefined });

  expect(editButton()).not.toBeInTheDocument();
});

test('the assistant is there for someone who may not edit', () => {
  // A canvas is read through the assistant as much as it is built with it.
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <button type="button">Bubble</button>,
    () => <div>Panel</div>,
  );
  renderToolbar({ canEdit: false, draftToken: undefined });

  expect(
    screen.getByRole('button', { name: /AI assistant/ }),
  ).toBeInTheDocument();
});
