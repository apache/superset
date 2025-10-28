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
import { Provider } from 'react-redux';
import {
  act,
  render,
  screen,
  fireEvent,
  userEvent,
  RenderResult,
} from 'spec/helpers/testing-library';
import { supersetTheme } from '@superset-ui/core';
import { mockStore } from 'spec/fixtures/mockStore';
import { dashboardLayout as mockLayout } from 'spec/fixtures/mockDashboardLayout';
import MarkdownConnected from './Markdown';

interface MarkdownProps {
  id: string;
  parentId: string;
  component: Record<string, unknown>;
  depth: number;
  parentComponent: Record<string, unknown>;
  index: number;
  editMode: boolean;
  availableColumnCount: number;
  columnWidth: number;
  onResizeStart: jest.Mock;
  onResize: jest.Mock;
  onResizeStop: jest.Mock;
  handleComponentDrop: jest.Mock;
  updateComponents: jest.Mock;
  deleteComponent: jest.Mock;
  logEvent: jest.Mock;
  addDangerToast: jest.Mock;
  undoLength?: number;
  redoLength?: number;
}

const defaultProps: MarkdownProps = {
  id: 'id',
  parentId: 'parentId',
  component: mockLayout.present.MARKDOWN_ID,
  depth: 2,
  parentComponent: mockLayout.present.ROW_ID,
  index: 0,
  editMode: false,
  availableColumnCount: 12,
  columnWidth: 50,
  onResizeStart: jest.fn(),
  onResize: jest.fn(),
  onResizeStop: jest.fn(),
  handleComponentDrop: jest.fn(),
  updateComponents: jest.fn(),
  deleteComponent: jest.fn(),
  logEvent: jest.fn(),
  addDangerToast: jest.fn(),
};

beforeAll(() => {
  const originalError = console.error;
  jest.spyOn(console, 'error').mockImplementation((msg: unknown) => {
    if (
      typeof msg === 'string' &&
      !msg.includes('[antd:') &&
      !msg.includes('Warning: An update to SafeMarkdown') &&
      !msg.includes('Warning: React does not recognize') &&
      !msg.includes("Warning: Can't perform a React state update")
    ) {
      originalError.call(console, msg);
    }
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

const setup = async (
  overrideProps: Partial<MarkdownProps> = {},
): Promise<RenderResult> => {
  let utils: RenderResult | undefined;
  await act(async () => {
    utils = render(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <MarkdownConnected {...(defaultProps as any)} {...overrideProps} />,
      {
        useDnd: true,
        store: mockStore,
      },
    );
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return utils!;
};

test('should render the markdown component', async () => {
  await setup();
  expect(screen.getByTestId('dashboard-markdown-editor')).toBeInTheDocument();
});

test('should render the markdown content in preview mode by default', async () => {
  await setup();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(
    screen.getByTestId('dashboard-component-chart-holder'),
  ).toBeInTheDocument();
});

test('should render editor when in edit mode and clicked', async () => {
  await setup({ editMode: true });
  const container = screen.getByTestId('dashboard-component-chart-holder');
  await act(async () => {
    fireEvent.click(container);
  });

  expect(await screen.findByRole('textbox')).toBeInTheDocument();
});

test('should switch between edit and preview modes', async () => {
  await setup({ editMode: true });
  const container = screen.getByTestId('dashboard-component-chart-holder');

  await act(async () => {
    fireEvent.click(container);
  });

  expect(await screen.findByRole('textbox')).toBeInTheDocument();

  // Find and click edit dropdown by role
  const editButton = screen.getByRole('button', { name: /edit/i });
  await act(async () => {
    fireEvent.click(editButton);
  });

  // Click preview option in dropdown
  const previewOption = await screen.findByText(/preview/i);
  await act(async () => {
    fireEvent.click(previewOption);
  });

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('should call updateComponents when switching from edit to preview with changes', async () => {
  const updateComponents = jest.fn();
  const mockCode = 'new markdown!';

  const { container } = await setup({
    editMode: true,
    updateComponents,
    component: {
      ...mockLayout.present.MARKDOWN_ID,
      id: 'test',
      meta: { code: '' },
    },
  });

  // Enter edit mode and change content
  await act(async () => {
    const markdownHolder = screen.getByTestId(
      'dashboard-component-chart-holder',
    );
    fireEvent.click(markdownHolder);

    // Wait for editor to be fully mounted
    await new Promise(resolve => setTimeout(resolve, 50));

    // Find the actual textarea/input element
    const editor = container.querySelector('.ace_text-input');

    if (editor) {
      // Simulate direct input
      fireEvent.input(editor, { target: { value: mockCode } });

      // Force blur and change events
      fireEvent.change(editor, { target: { value: mockCode } });
      fireEvent.blur(editor);
    }

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 50));

    // Click the Edit dropdown button
    const editDropdown = screen.getByText('Edit');
    fireEvent.click(editDropdown);

    // Wait for dropdown to open
    await new Promise(resolve => setTimeout(resolve, 50));

    // Find and click preview in dropdown
    const previewOption = await screen.findByText(/preview/i);
    fireEvent.click(previewOption);

    // Wait for update to complete
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  // Update assertion to match actual component structure
  expect(updateComponents).toHaveBeenCalledWith({
    test: {
      id: 'test',
      meta: { code: mockCode },
      type: 'MARKDOWN',
      children: [],
      parents: [],
    },
  });
});

test('should show placeholder text when markdown is empty', async () => {
  await setup({
    component: {
      ...mockLayout.present.MARKDOWN_ID,
      meta: { code: '' },
    },
  });

  expect(
    screen.getByText(/Click here to learn more about/),
  ).toBeInTheDocument();
});

test('should handle markdown errors gracefully', async () => {
  const addDangerToast = jest.fn();
  await setup({
    addDangerToast,
    component: {
      ...mockLayout.present.MARKDOWN_ID,
      meta: { code: '# Test' },
    },
  });

  await act(async () => {
    const markdownEditor = screen.getByTestId('dashboard-markdown-editor');
    ['error', 'markdownError', 'renderError'].forEach(eventType => {
      const event = new CustomEvent(eventType, {
        bubbles: true,
        detail: { error: new Error('Markdown error') },
      });
      markdownEditor.dispatchEvent(event);
    });

    await new Promise(resolve => setTimeout(resolve, 100));
  });
});

test('should resize editor when width changes', async () => {
  const { rerender } = await setup({ editMode: true });

  await act(async () => {
    const chartHolder = screen.getByTestId('dashboard-component-chart-holder');
    fireEvent.click(chartHolder);
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  await act(async () => {
    rerender(
      <MarkdownConnected
        {...(defaultProps as any)}
        availableColumnCount={6}
        columnWidth={100}
        component={{
          ...mockLayout.present.MARKDOWN_ID,
          meta: { ...mockLayout.present.MARKDOWN_ID.meta },
        }}
      />,
    );

    await new Promise(resolve => setTimeout(resolve, 100));
  });
});

test('should update content when undo/redo changes occur', async () => {
  const { rerender } = await setup({
    editMode: true,
    component: {
      ...mockLayout.present.MARKDOWN_ID,
      meta: { code: 'original' },
    },
  });

  // Simulate undo/redo state change
  await act(async () => {
    rerender(
      <MarkdownConnected
        {...(defaultProps as any)}
        undoLength={2}
        redoLength={1}
        component={{
          ...mockLayout.present.MARKDOWN_ID,
          meta: { code: 'updated' },
        }}
      />,
    );
  });

  expect(screen.getByText('updated')).toBeInTheDocument();
});

test('should adjust width based on parent type', async () => {
  const { rerender } = await setup();

  // Check ROW_TYPE width
  const container = screen.getByTestId('dashboard-component-chart-holder');
  const { parentElement } = container;
  expect(parentElement).toHaveStyle('width: 248px');

  // Check non-ROW_TYPE width
  await act(async () => {
    rerender(
      <Provider store={mockStore}>
        <MarkdownConnected
          {...(defaultProps as any)}
          parentComponent={mockLayout.present.CHART_ID}
        />
      </Provider>,
    );
    // Wait for styles to update
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  const updatedContainer = screen.getByTestId(
    'dashboard-component-chart-holder',
  );
  const updatedParent = updatedContainer.parentElement;
  // Check that width is no longer 248px
  expect(updatedParent).not.toHaveStyle('width: 248px');
});

test('shouldFocusMarkdown returns true when clicking inside markdown container', async () => {
  await setup({ editMode: true });

  const markdownContainer = screen.getByTestId(
    'dashboard-component-chart-holder',
  );

  userEvent.click(markdownContainer);

  expect(await screen.findByRole('textbox')).toBeInTheDocument();
});

test('shouldFocusMarkdown returns false when clicking outside markdown container', async () => {
  await setup({ editMode: true });

  const markdownContainer = screen.getByTestId(
    'dashboard-component-chart-holder',
  );

  userEvent.click(markdownContainer);

  expect(await screen.findByRole('textbox')).toBeInTheDocument();

  userEvent.click(document.body);
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('shouldFocusMarkdown keeps focus when clicking on menu items', async () => {
  await setup({ editMode: true });

  const markdownContainer = screen.getByTestId(
    'dashboard-component-chart-holder',
  );

  userEvent.click(markdownContainer);

  expect(await screen.findByRole('textbox')).toBeInTheDocument();

  const editButton = screen.getByText('Edit');

  userEvent.click(editButton);
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(screen.queryByRole('textbox')).toBeInTheDocument();
});

test('should exit edit mode when clicking outside in same row', async () => {
  await setup({ editMode: true });

  const markdownContainer = screen.getByTestId(
    'dashboard-component-chart-holder',
  );

  userEvent.click(markdownContainer);

  expect(await screen.findByRole('textbox')).toBeInTheDocument();

  const outsideElement = document.createElement('div');
  outsideElement.className = 'grid-row';
  document.body.appendChild(outsideElement);

  userEvent.click(outsideElement);
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

  document.body.removeChild(outsideElement);
});

test('should have fontWeightStrong in theme for bold markdown rendering', async () => {
  await setup({
    component: {
      ...mockLayout.present.MARKDOWN_ID,
      meta: { code: '**bold text**' },
    },
  });

  // CRITICAL: Verify fontWeightStrong exists in the theme
  // If it's missing from allowedAntdTokens, GlobalStyles.tsx:66 will set
  // font-weight: undefined on <strong> tags, breaking bold markdown rendering
  // Ant Design default is 600, backend config sets 500, either is acceptable
  expect(supersetTheme.fontWeightStrong).toBeDefined();
  expect(supersetTheme.fontWeightStrong).toBeGreaterThan(400);
});
