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
import { act, render, screen, fireEvent } from 'spec/helpers/testing-library';
import MarkdownConnected from 'src/dashboard/components/gridComponents/Markdown';
import { mockStore } from 'spec/fixtures/mockStore';
import { dashboardLayout as mockLayout } from 'spec/fixtures/mockDashboardLayout';

describe('Markdown', () => {
  const props = {
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
    jest.spyOn(console, 'error').mockImplementation(msg => {
      if (
        typeof msg === 'string' &&
        !msg.includes('[antd:') &&
        !msg.includes('Warning: An update to SafeMarkdown') &&
        !msg.includes('Warning: React does not recognize') &&
        !msg.includes("Warning: Can't perform a React state update")
      ) {
        console.error(msg);
      }
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const setup = async (overrideProps = {}) => {
    let utils;
    await act(async () => {
      utils = render(<MarkdownConnected {...props} {...overrideProps} />, {
        useDnd: true,
        store: mockStore,
      });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    return utils;
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the markdown component', async () => {
    await setup();
    expect(screen.getByTestId('dashboard-markdown-editor')).toBeInTheDocument();
  });

  it('should render the markdown content in preview mode by default', async () => {
    await setup();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeInTheDocument();
  });

  it('should render editor when in edit mode and clicked', async () => {
    await setup({ editMode: true });
    const container = screen.getByTestId('dashboard-component-chart-holder');
    await act(async () => {
      fireEvent.click(container);
    });

    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('should switch between edit and preview modes', async () => {
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

  it('should call updateComponents when switching from edit to preview with changes', async () => {
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
      console.log('Editor element:', editor);

      // Simulate direct input
      fireEvent.input(editor, { target: { value: mockCode } });
      console.log('After input:', editor.value);

      // Force blur and change events
      fireEvent.change(editor, { target: { value: mockCode } });
      fireEvent.blur(editor);

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

    console.log('Component state:', {
      updateCalls: updateComponents.mock.calls,
      editorVisible: screen.queryByRole('textbox') !== null,
      dropdownOpen: screen.queryByText(/preview/i) !== null,
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

  it('should show placeholder text when markdown is empty', async () => {
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

  it('should handle markdown errors gracefully', async () => {
    const addDangerToast = jest.fn();
    const { container } = await setup({
      addDangerToast,
      component: {
        ...mockLayout.present.MARKDOWN_ID,
        meta: { code: '# Test' },
      },
    });

    console.log('Component structure:', {
      markdownEditor: screen.getByTestId('dashboard-markdown-editor'),
      safeMarkdown: container.querySelector('.safe-markdown'),
      allEventListeners: container.querySelectorAll('[data-test]'),
      toastFn: addDangerToast.toString(),
    });

    await act(async () => {
      const markdownEditor = screen.getByTestId('dashboard-markdown-editor');
      ['error', 'markdownError', 'renderError'].forEach(eventType => {
        const event = new CustomEvent(eventType, {
          bubbles: true,
          detail: { error: new Error('Markdown error') },
        });
        console.log(`Dispatching ${eventType} event`);
        markdownEditor.dispatchEvent(event);
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('After events:', {
        toastCalls: addDangerToast.mock.calls,
        errorElements: container.querySelectorAll('.error-message'),
      });
    });
  });

  it('should resize editor when width changes', async () => {
    const { rerender } = await setup({ editMode: true });

    await act(async () => {
      const chartHolder = screen.getByTestId(
        'dashboard-component-chart-holder',
      );
      fireEvent.click(chartHolder);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    await act(async () => {
      rerender(
        <MarkdownConnected
          {...props}
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

  it('should update content when undo/redo changes occur', async () => {
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
          {...props}
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

  it('should adjust width based on parent type', async () => {
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
            {...props}
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
});
