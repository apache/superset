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
import { useState, ReactElement } from 'react';
import {
  render as rtlRender,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/theme';
import type { editors } from '@apache-superset/core';
import AceEditorProvider from './AceEditorProvider';

type EditorProps = editors.EditorProps;

const mockEventHandlers: Record<string, (() => void) | undefined> = {};

// Captures the latest props passed to the mocked editor component so tests
// can drive the onChange contract the way react-ace fires it.
let mockEditorProps: Record<string, any> = {};

const mockEditor = {
  focus: jest.fn(),
  getCursorPosition: jest.fn(() => ({ row: 1, column: 5 })),
  getSelection: jest.fn(() => ({
    getRange: () => ({
      start: { row: 0, column: 0 },
      end: { row: 0, column: 10 },
    }),
  })),
  commands: { addCommand: jest.fn() },
  selection: {
    on: jest.fn((event: string, handler: () => void) => {
      mockEventHandlers[event] = handler;
    }),
  },
};

let mockOnLoadCallback: ((editor: typeof mockEditor) => void) | undefined;

jest.mock('@superset-ui/core/components', () => ({
  __esModule: true,
  FullSQLEditor: jest.fn((props: { onLoad?: () => void }) => {
    mockEditorProps = props;
    mockOnLoadCallback = props.onLoad;
    return <div data-test="sql-editor" />;
  }),
  JsonEditor: () => <div data-test="json-editor" />,
  MarkdownEditor: () => <div data-test="markdown-editor" />,
  CssEditor: () => <div data-test="css-editor" />,
  ConfigEditor: () => <div data-test="config-editor" />,
}));

const render = (ui: ReactElement) =>
  rtlRender(<ThemeProvider theme={supersetTheme}>{ui}</ThemeProvider>);

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockOnLoadCallback = undefined;
  mockEditorProps = {};
  Object.keys(mockEventHandlers).forEach(key => delete mockEventHandlers[key]);
});

const defaultProps: EditorProps = {
  id: 'test-editor',
  value: 'SELECT * FROM table',
  onChange: jest.fn(),
  language: 'sql',
};

const renderEditor = (props: Partial<EditorProps> = {}) => {
  const result = render(<AceEditorProvider {...defaultProps} {...props} />);
  if (mockOnLoadCallback) {
    mockOnLoadCallback(mockEditor);
  }
  return result;
};

test('onSelectionChange uses latest callback after prop change', async () => {
  const firstCallback = jest.fn();
  const secondCallback = jest.fn();

  const CallbackSwitcher = () => {
    const [useSecond, setUseSecond] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setUseSecond(true)}>
          Switch
        </button>
        <AceEditorProvider
          {...defaultProps}
          onSelectionChange={useSecond ? secondCallback : firstCallback}
        />
      </>
    );
  };

  render(<CallbackSwitcher />);

  if (mockOnLoadCallback) {
    mockOnLoadCallback(mockEditor);
  }

  await waitFor(() => expect(mockEventHandlers.changeSelection).toBeDefined());

  mockEventHandlers.changeSelection!();
  expect(firstCallback).toHaveBeenCalled();
  expect(secondCallback).not.toHaveBeenCalled();
  firstCallback.mockClear();

  await userEvent.click(screen.getByRole('button', { name: /switch/i }));
  mockEventHandlers.changeSelection!();

  expect(secondCallback).toHaveBeenCalled();
  expect(firstCallback).not.toHaveBeenCalled();
});

test('onCursorPositionChange uses latest callback after prop change', async () => {
  const firstCallback = jest.fn();
  const secondCallback = jest.fn();

  const CallbackSwitcher = () => {
    const [useSecond, setUseSecond] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setUseSecond(true)}>
          Switch
        </button>
        <AceEditorProvider
          {...defaultProps}
          onCursorPositionChange={useSecond ? secondCallback : firstCallback}
        />
      </>
    );
  };

  render(<CallbackSwitcher />);

  if (mockOnLoadCallback) {
    mockOnLoadCallback(mockEditor);
  }

  await waitFor(() => expect(mockEventHandlers.changeCursor).toBeDefined());

  mockEventHandlers.changeCursor!();
  expect(firstCallback).toHaveBeenCalled();
  expect(secondCallback).not.toHaveBeenCalled();
  firstCallback.mockClear();

  await userEvent.click(screen.getByRole('button', { name: /switch/i }));
  mockEventHandlers.changeCursor!();

  expect(secondCallback).toHaveBeenCalled();
  expect(firstCallback).not.toHaveBeenCalled();
});

test('cursor position callback receives correct position format', async () => {
  const onCursorPositionChange = jest.fn();
  renderEditor({ onCursorPositionChange });

  await waitFor(() => expect(mockEventHandlers.changeCursor).toBeDefined());
  mockEventHandlers.changeCursor!();

  expect(onCursorPositionChange).toHaveBeenCalledWith({ line: 1, column: 5 });
});

test('selection callback receives correct range format', async () => {
  const onSelectionChange = jest.fn();
  renderEditor({ onSelectionChange });

  await waitFor(() => expect(mockEventHandlers.changeSelection).toBeDefined());
  mockEventHandlers.changeSelection!();

  expect(onSelectionChange).toHaveBeenCalledWith([
    { start: { line: 0, column: 0 }, end: { line: 0, column: 10 } },
  ]);
});

test('onChange emits once per task with the final value when the editor fires several change events', async () => {
  // With several cursors Ace applies a keystroke per selection, so react-ace
  // reports an intermediate document value (first cursor applied) and then
  // the final one within the same task. The provider must coalesce them:
  // an intermediate value rendered back into the controlled `value` prop
  // makes react-ace call editor.setValue() mid-keystroke, which collapses
  // the multi-selection and moves a cursor to the document end.
  const onChange = jest.fn();
  renderEditor({ onChange });

  const editorOnChange = mockEditorProps.onChange as (v: string) => void;
  expect(editorOnChange).toBeDefined();

  editorOnChange('abcX');
  editorOnChange('abcX\ndefX');

  expect(onChange).not.toHaveBeenCalled();

  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  expect(onChange).toHaveBeenCalledWith('abcX\ndefX');
});

test('a pending value is delivered when the editor unmounts mid-keystroke', async () => {
  const onChange = jest.fn();
  const { unmount } = renderEditor({ onChange });

  const editorOnChange = mockEditorProps.onChange as (v: string) => void;
  editorOnChange('abcX');

  unmount();

  await waitFor(() => expect(onChange).toHaveBeenCalledWith('abcX'));
});
