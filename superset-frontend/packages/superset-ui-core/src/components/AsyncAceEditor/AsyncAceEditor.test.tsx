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
import { supersetTheme } from '@apache-superset/core/theme';
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
  aceCompletionHighlightStyles,
} from '.';

import type { AceModule, AsyncAceEditorOptions } from './types';

const selector = '[id="ace-editor"]';

test('renders SQLEditor', async () => {
  const { container } = render(<SQLEditor />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });
});

test('themes the autocomplete completion highlight from the theme', () => {
  // Ace ships a hardcoded `color: #000` for the matched-prefix highlight, which
  // is invisible on the dark autocomplete popup. The shared editor overrides it
  // from the theme so every Ace editor (SQL Lab, Explore Custom SQL, ...) stays
  // consistent.
  const { styles } = aceCompletionHighlightStyles(supersetTheme);

  expect(styles).toContain('.ace_completion-highlight');
  expect(styles).toContain(supersetTheme.colorPrimaryText);
});

test('SQLEditor uses fontFamilyCode from theme', async () => {
  const ref = createRef<AceEditor>();
  const { container } = render(<SQLEditor ref={ref as React.Ref<never>} />);

  await waitFor(() => {
    expect(container.querySelector(selector)).toBeInTheDocument();
  });

  const editorInstance = ref.current?.editor;
  const fontFamily = editorInstance?.getOption('fontFamily');
  // Verify font family is set (not undefined) and contains a monospace font
  expect(fontFamily).toBeDefined();
  expect(fontFamily).toMatch(/mono|courier|consolas/i);
});

test('re-measures Ace font metrics on load and preserves a consumer onLoad (#41664)', async () => {
  // Ace caches glyph width at construction; if the editor font settles later,
  // the caret drifts. The editor forces a re-measure on load and again once
  // `document.fonts.ready` resolves. Mock `document.fonts` so the re-measure
  // path is deterministic regardless of the jsdom FontFaceSet implementation.
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
  const fontsReady = Promise.resolve();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: fontsReady },
  });

  const ref = createRef<AceEditor>();
  let updateFontSizeSpy: jest.SpyInstance | undefined;
  // The spy is installed from inside the consumer onLoad, so it captures the
  // asynchronous (post-fonts-ready) re-measure that runs after this callback.
  const consumerOnLoad = jest.fn((editor: AceEditor['editor']) => {
    // Cast to a minimal shape so `jest.spyOn` resolves cleanly; it is the
    // same renderer instance the component re-measures, so the spy still
    // observes the production calls.
    const renderer = editor.renderer as unknown as {
      updateFontSize: () => void;
    };
    updateFontSizeSpy = jest.spyOn(renderer, 'updateFontSize');
  });

  try {
    const { container } = render(
      <SQLEditor
        ref={ref as React.Ref<never>}
        onLoad={consumerOnLoad as never}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(selector)).toBeInTheDocument();
    });

    // The wrapper must call through to the consumer's onLoad with the editor.
    expect(consumerOnLoad).toHaveBeenCalledTimes(1);
    expect(consumerOnLoad).toHaveBeenCalledWith(ref.current?.editor);

    // Once fonts settle, the editor re-measures (Ace itself resizes and
    // re-renders when the measured character size changed) so the caret
    // realigns.
    await fontsReady;
    await waitFor(() => {
      expect(updateFontSizeSpy).toHaveBeenCalled();
    });
  } finally {
    updateFontSizeSpy?.mockRestore();
    if (originalFonts) {
      Object.defineProperty(document, 'fonts', originalFonts);
    } else {
      delete (document as { fonts?: unknown }).fonts;
    }
  }
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
    placeholder: () => <p>Custom placeholder</p>,
  };
  const Editor = AsyncAceEditor(aceModules, editorOptions);

  render(<Editor />);

  expect(screen.getByText('Custom placeholder')).toBeInTheDocument();
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
  type CommandManagerWithEmit = typeof editorInstance.commands & {
    _emit: (event: string, data: unknown) => void;
  };
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
  type CommandManagerWithEmit = typeof editorInstance.commands & {
    _emit: (event: string, data: unknown) => void;
  };
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
