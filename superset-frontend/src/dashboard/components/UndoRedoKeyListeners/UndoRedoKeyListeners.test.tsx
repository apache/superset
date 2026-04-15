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
import { render, fireEvent } from 'spec/helpers/testing-library';
import UndoRedoKeyListeners from '.';

const defaultProps = {
  onUndo: jest.fn(),
  onRedo: jest.fn(),
};

test('renders nothing', () => {
  const { container } = render(<UndoRedoKeyListeners {...defaultProps} />);
  expect(container.children).toHaveLength(0);
});

test('triggers onUndo', () => {
  const onUndo = jest.fn();
  render(<UndoRedoKeyListeners {...defaultProps} onUndo={onUndo} />);
  fireEvent.keyDown(document.body, { key: 'z', keyCode: 90, ctrlKey: true });
  expect(onUndo).toHaveBeenCalledTimes(1);
});

test('triggers onRedo', () => {
  const onRedo = jest.fn();
  render(<UndoRedoKeyListeners {...defaultProps} onRedo={onRedo} />);
  fireEvent.keyDown(document.body, { key: 'y', keyCode: 89, ctrlKey: true });
  expect(onRedo).toHaveBeenCalledTimes(1);
});

test('does not trigger when it is another key', () => {
  const onUndo = jest.fn();
  const onRedo = jest.fn();
  render(<UndoRedoKeyListeners onUndo={onUndo} onRedo={onRedo} />);
  fireEvent.keyDown(document.body, { key: 'x', keyCode: 88, ctrlKey: true });
  expect(onUndo).not.toHaveBeenCalled();
  expect(onRedo).not.toHaveBeenCalled();
});

test('removes the event listener when unmounts', () => {
  document.removeEventListener = jest.fn();
  const { unmount } = render(<UndoRedoKeyListeners {...defaultProps} />);
  unmount();
  expect(document.removeEventListener).toHaveBeenCalledWith(
    'keydown',
    expect.anything(),
  );
});
