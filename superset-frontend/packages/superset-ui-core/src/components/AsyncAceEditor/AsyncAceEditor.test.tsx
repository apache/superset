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
import { createRef } from 'react';
import { render, screen, waitFor } from '@superset-ui/core/spec';
import type AceEditor from 'react-ace';
import {
  AsyncAceEditor,
  SQLEditor,
  FullSQLEditor,
  MarkdownEditor,
  TextAreaEditor,
  CssEditor,
  JsonEditor,
  ConfigEditor,
} from '.';

import type { AceModule, AsyncAceEditorOptions } from './types';

const selector = '[id="ace-editor"]';

test('renders SQLEditor', async () => {
  const { container } = render(<SQLEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders FullSQLEditor', async () => {
  const { container } = render(<FullSQLEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders MarkdownEditor', async () => {
  const { container } = render(<MarkdownEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders TextAreaEditor', async () => {
  const { container } = render(<TextAreaEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders CssEditor', async () => {
  const { container } = render(<CssEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders JsonEditor', async () => {
  const { container } = render(<JsonEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders ConfigEditor', async () => {
  const { container } = render(<ConfigEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('renders a custom placeholder', () => {
  const aceModules: AceModule[] = ['mode/css', 'theme/github'];
  const editorOptions: AsyncAceEditorOptions = {
    placeholder: () => <p role="paragraph">Custom placeholder</p>,
  };
  const Editor = AsyncAceEditor(aceModules, editorOptions);

  render(<Editor />);

  expect(screen.getByRole('paragraph')).toBeInTheDocument();
});

test('registers afterExec event listener for command handling', async () => {
  const ref = createRef<AceEditor>();
  const { container } = render(<SQLEditor ref={ref as React.Ref<never>} />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  expect(editorInstance).toBeDefined();

  if (!editorInstance) return;

  // Verify the commands object has the 'on' method (confirms event listener capability)
  expect(editorInstance.commands).toHaveProperty('on');
  expect(typeof editorInstance.commands.on).toBe('function');
});

test('moves autocomplete popup to parent container when triggered', async () => {
  const ref = createRef<AceEditor>();
  const { container } = render(<SQLEditor ref={ref as React.Ref<never>} />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  expect(editorInstance).toBeDefined();

  if (!editorInstance) return;

  // Create a mock autocomplete popup in the editor container
  const mockAutocompletePopup = document.createElement('div');
  mockAutocompletePopup.className = 'ace_autocomplete';
  editorInstance.container?.appendChild(mockAutocompletePopup);

  const parentContainer =
    editorInstance.container?.closest('#ace-editor') ??
    editorInstance.container?.parentElement;

  // Manually trigger the afterExec event with insertstring command using _emit
  // Note: Using _emit is necessary here to test internal event handling behavior
  // since there's no public API to trigger the afterExec event directly
  type CommandManagerWithEmit = typeof editorInstance.commands & {
    _emit: (event: string, data: unknown) => void;
  };
  // eslint-disable-next-line no-underscore-dangle
  (editorInstance.commands as CommandManagerWithEmit)._emit('afterExec', {
    command: { name: 'insertstring' },
    args: ['SELECT'],
  });

  await waitFor(() => {
    // Check that the popup has the data attribute set
    expect(mockAutocompletePopup.dataset.aceAutocomplete).toBe('true');
    // Check that the popup is in the parent container
    expect(parentContainer?.contains(mockAutocompletePopup)).toBe(true);
  });
});

test('moves autocomplete popup on startAutocomplete command event', async () => {
  const ref = createRef<AceEditor>();
  const { container } = render(<SQLEditor ref={ref as React.Ref<never>} />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  expect(editorInstance).toBeDefined();

  if (!editorInstance) return;

  // Create a mock autocomplete popup
  const mockAutocompletePopup = document.createElement('div');
  mockAutocompletePopup.className = 'ace_autocomplete';
  editorInstance.container?.appendChild(mockAutocompletePopup);

  const parentContainer =
    editorInstance.container?.closest('#ace-editor') ??
    editorInstance.container?.parentElement;

  // Manually trigger the afterExec event with startAutocomplete command
  // Note: Using _emit is necessary here to test internal event handling behavior
  // since there's no public API to trigger the afterExec event directly
  type CommandManagerWithEmit = typeof editorInstance.commands & {
    _emit: (event: string, data: unknown) => void;
  };
  // eslint-disable-next-line no-underscore-dangle
  (editorInstance.commands as CommandManagerWithEmit)._emit('afterExec', {
    command: { name: 'startAutocomplete' },
  });

  await waitFor(() => {
    // Check that the popup has the data attribute set
    expect(mockAutocompletePopup.dataset.aceAutocomplete).toBe('true');
    // Check that the popup is in the parent container
    expect(parentContainer?.contains(mockAutocompletePopup)).toBe(true);
  });
});

test('does not move autocomplete popup on unrelated commands', async () => {
  const ref = createRef<AceEditor>();
  const { container } = render(<SQLEditor ref={ref as React.Ref<never>} />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  expect(editorInstance).toBeDefined();

  if (!editorInstance) return;

  // Create a mock autocomplete popup in the body
  const mockAutocompletePopup = document.createElement('div');
  mockAutocompletePopup.className = 'ace_autocomplete';
  document.body.appendChild(mockAutocompletePopup);

  const originalParent = mockAutocompletePopup.parentElement;

  // Simulate an unrelated command (e.g., 'selectall')
  editorInstance.commands.exec('selectall', editorInstance, {});

  // Wait a bit to ensure no movement happens
  await new Promise(resolve => {
    setTimeout(resolve, 100);
  });

  // The popup should remain in its original location
  expect(mockAutocompletePopup.parentElement).toBe(originalParent);

  // Cleanup
  document.body.removeChild(mockAutocompletePopup);
});

test('revalidates cached autocomplete popup when detached from DOM', async () => {
  const ref = createRef<AceEditor>();
  const { container } = render(<SQLEditor ref={ref as React.Ref<never>} />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  expect(editorInstance).toBeDefined();

  if (!editorInstance) return;

  // Create first autocomplete popup
  const firstPopup = document.createElement('div');
  firstPopup.className = 'ace_autocomplete';
  editorInstance.container?.appendChild(firstPopup);

  // Trigger command to cache the first popup
  editorInstance.commands.exec('insertstring', editorInstance, 'SELECT');

  await waitFor(() => {
    expect(firstPopup.dataset.aceAutocomplete).toBe('true');
  });

  // Remove the first popup from DOM (simulating ACE editor replacing it)
  firstPopup.remove();

  // Create a new autocomplete popup
  const secondPopup = document.createElement('div');
  secondPopup.className = 'ace_autocomplete';
  editorInstance.container?.appendChild(secondPopup);

  // Trigger command again - should find and move the new popup
  editorInstance.commands.exec('insertstring', editorInstance, ' ');

  await waitFor(() => {
    expect(secondPopup.dataset.aceAutocomplete).toBe('true');
    const parentContainer =
      editorInstance.container?.closest('#ace-editor') ??
      editorInstance.container?.parentElement;
    expect(parentContainer?.contains(secondPopup)).toBe(true);
  });
});

test('cleans up event listeners on unmount', async () => {
  const ref = createRef<AceEditor>();
  const { container, unmount } = render(
    <SQLEditor ref={ref as React.Ref<never>} />,
  );
  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  expect(editorInstance).toBeDefined();

  if (!editorInstance) return;

  // Spy on the commands.off method
  const offSpy = jest.spyOn(editorInstance.commands, 'off');

  // Unmount the component
  unmount();

  // Verify that the event listener was removed
  expect(offSpy).toHaveBeenCalledWith('afterExec', expect.any(Function));

  offSpy.mockRestore();
});

test('does not move autocomplete popup if target container is document.body', async () => {
  const ref = createRef<AceEditor>();
  const { container } = render(<SQLEditor ref={ref as React.Ref<never>} />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  expect(editorInstance).toBeDefined();

  if (!editorInstance) return;

  // Create a mock autocomplete popup
  const mockAutocompletePopup = document.createElement('div');
  mockAutocompletePopup.className = 'ace_autocomplete';
  document.body.appendChild(mockAutocompletePopup);

  // Mock the closest method to return null (simulating no #ace-editor parent)
  const originalClosest = editorInstance.container?.closest;
  if (editorInstance.container) {
    editorInstance.container.closest = jest.fn(() => null);
  }

  // Mock parentElement to be document.body
  Object.defineProperty(editorInstance.container, 'parentElement', {
    value: document.body,
    configurable: true,
  });

  const initialParent = mockAutocompletePopup.parentElement;

  // Trigger command
  editorInstance.commands.exec('insertstring', editorInstance, 'SELECT');

  await new Promise(resolve => {
    setTimeout(resolve, 100);
  });

  // The popup should NOT be moved because target container is document.body
  expect(mockAutocompletePopup.parentElement).toBe(initialParent);

  // Cleanup
  if (editorInstance.container && originalClosest) {
    editorInstance.container.closest = originalClosest;
  }
  document.body.removeChild(mockAutocompletePopup);
});
