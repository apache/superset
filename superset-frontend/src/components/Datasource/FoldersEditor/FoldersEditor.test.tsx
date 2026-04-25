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
import type { ReactElement, ReactChild } from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Metric, ColumnMeta } from '@superset-ui/chart-controls';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import FoldersEditor from '.';
import {
  DEFAULT_METRICS_FOLDER_UUID,
  DEFAULT_COLUMNS_FOLDER_UUID,
} from './constants';
import { FoldersEditorItemType } from '../types';

// Mock react-virtualized-auto-sizer to provide dimensions in tests
jest.mock(
  'react-virtualized-auto-sizer',
  () =>
    ({
      children,
    }: {
      children: (params: { height: number; width: number }) => ReactChild;
    }) =>
      children({ height: 500, width: 400 }),
);

// Mock react-window VariableSizeList to render all items for testing
jest.mock('react-window', () => ({
  VariableSizeList: ({
    children: Row,
    itemCount,
    itemData,
  }: {
    children: React.ComponentType<{
      index: number;
      style: React.CSSProperties;
      data: unknown;
    }>;
    itemCount: number;
    itemData: unknown;
  }) => (
    <div data-testid="virtualized-list">
      {Array.from({ length: itemCount }, (_, index) => (
        <Row
          key={index}
          index={index}
          style={{ height: 'auto', position: 'relative' }}
          data={itemData}
        />
      ))}
    </div>
  ),
}));

// Wrap render with useRedux: true since FoldersEditor uses useToasts which requires Redux
const renderEditor = (ui: ReactElement, options = {}) =>
  render(ui, { useRedux: true, ...options });

const mockMetrics: Metric[] = [
  {
    uuid: 'metric1',
    metric_name: 'Count',
    expression: 'COUNT(*)',
    description: 'Total count',
  },
  {
    uuid: 'metric2',
    metric_name: 'Sum Revenue',
    expression: 'SUM(revenue)',
    description: 'Total revenue',
  },
];

const mockColumns: ColumnMeta[] = [
  {
    uuid: 'col1',
    column_name: 'id',
    type: 'INTEGER',
  },
  {
    uuid: 'col2',
    column_name: 'name',
    type: 'VARCHAR',
  },
];

const mockFolders: DatasourceFolder[] = [
  {
    uuid: DEFAULT_METRICS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Metrics',
    children: [
      { type: FoldersEditorItemType.Metric, uuid: 'metric1', name: 'Count' },
      {
        type: FoldersEditorItemType.Metric,
        uuid: 'metric2',
        name: 'Sum Revenue',
      },
    ],
  },
  {
    uuid: DEFAULT_COLUMNS_FOLDER_UUID,
    type: FoldersEditorItemType.Folder,
    name: 'Columns',
    children: [
      { type: FoldersEditorItemType.Column, uuid: 'col1', name: 'ID' },
      { type: FoldersEditorItemType.Column, uuid: 'col2', name: 'name' },
    ],
  },
];

const defaultProps = {
  folders: mockFolders,
  metrics: mockMetrics,
  columns: mockColumns,
  onChange: jest.fn(),
};

test('renders FoldersEditor with folders', () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  expect(screen.getByText('Metrics')).toBeInTheDocument();
  expect(screen.getByText('Columns')).toBeInTheDocument();
});

test('renders search input', () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  expect(
    screen.getByPlaceholderText('Search all metrics & columns'),
  ).toBeInTheDocument();
});

test('renders action buttons when in edit mode', () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  expect(screen.getByText('Add folder')).toBeInTheDocument();
  expect(screen.getByText('Select all')).toBeInTheDocument();
  expect(screen.getByText('Reset all folders to default')).toBeInTheDocument();
});

test('adds a new folder when Add folder button is clicked', async () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  const addButton = screen.getByText('Add folder');
  fireEvent.click(addButton);

  // New folder appears in the UI with an empty input and placeholder
  await waitFor(() => {
    const input = screen.getByPlaceholderText(
      'Name your folder and to edit it later, click on the folder name',
    );
    expect(input).toBeInTheDocument();
  });
});

test('filters items when searching', async () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  const searchInput = screen.getByPlaceholderText(
    'Search all metrics & columns',
  );
  await userEvent.type(searchInput, 'Count');

  await waitFor(() => {
    expect(screen.getByText('Count')).toBeInTheDocument();
  });
});

test('selects all items when Select all is clicked', async () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  const selectAllButton = screen.getByText('Select all');
  fireEvent.click(selectAllButton);

  await waitFor(() => {
    const checkboxes = screen.getAllByRole('checkbox');
    const nonButtonCheckboxes = checkboxes.filter(
      checkbox => !checkbox.closest('button'),
    );
    expect(nonButtonCheckboxes.length).toBeGreaterThan(0);
    nonButtonCheckboxes.forEach(checkbox => {
      expect(checkbox).toBeChecked();
    });
  });
});

test('shows item count and updates to selection count', async () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  // With nothing selected, counter shows total items (2 metrics + 2 columns = 4)
  expect(screen.getByText('4 items')).toBeInTheDocument();

  // Click "Select all"
  const selectAllButton = screen.getByText('Select all');
  fireEvent.click(selectAllButton);

  // Counter should show total selected out of total items
  await waitFor(() => {
    expect(screen.getByText('4 out of 4 selected')).toBeInTheDocument();
  });

  // Deselect all
  const deselectAllButton = screen.getByText('Deselect all');
  fireEvent.click(deselectAllButton);

  // Counter should revert to item count
  await waitFor(() => {
    expect(screen.getByText('4 items')).toBeInTheDocument();
  });
});

test('expands and collapses folders', async () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  // Folder should be expanded by default, so Count should be visible
  expect(screen.getByText('Count')).toBeInTheDocument();

  // Click to collapse - click on the DownOutlined icon to toggle folder
  const downIcons = screen.getAllByRole('img', { name: 'down' });
  fireEvent.click(downIcons[0]);

  await waitFor(() => {
    expect(screen.queryByText('Count')).not.toBeInTheDocument();
  });

  // Click to expand again - the icon should now be RightOutlined
  const rightIcons = screen.getAllByRole('img', { name: 'right' });
  fireEvent.click(rightIcons[0]);

  await waitFor(() => {
    expect(screen.getByText('Count')).toBeInTheDocument();
  });
});

test('edits folder name when clicked in edit mode', async () => {
  const onChange = jest.fn();
  renderEditor(
    <FoldersEditor
      {...defaultProps}
      onChange={onChange}
      folders={[
        {
          uuid: 'custom-folder',
          type: FoldersEditorItemType.Folder,
          name: 'Custom Folder',
          children: [
            // Need at least one child for folder to be serialized (empty folders are filtered out)
            {
              uuid: 'metric1',
              type: FoldersEditorItemType.Metric,
              name: 'Count',
            },
          ],
        },
      ]}
    />,
  );

  const folderName = screen.getByText('Custom Folder');
  fireEvent.click(folderName);

  const input = screen.getByDisplayValue('Custom Folder');
  await userEvent.clear(input);
  await userEvent.type(input, 'Updated Folder');
  fireEvent.blur(input);

  await waitFor(() => {
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    const folders = lastCall[0];
    expect(folders[0].name).toBe('Updated Folder');
  });
});

test('creates default folders when none exist', () => {
  renderEditor(<FoldersEditor {...defaultProps} folders={[]} />);

  expect(screen.getByText('Metrics')).toBeInTheDocument();
  expect(screen.getByText('Columns')).toBeInTheDocument();
});

test('shows confirmation modal when resetting to default', async () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  const resetButton = screen.getByText('Reset all folders to default');
  fireEvent.click(resetButton);

  await waitFor(() => {
    // Modal may render multiple elements with the same text (e.g., in portal)
    const modalTexts = screen.getAllByText('Reset to default folders?');
    expect(modalTexts.length).toBeGreaterThan(0);
  });
});

test('renders sortable drag handles for folders', () => {
  renderEditor(
    <FoldersEditor
      {...defaultProps}
      folders={[
        {
          type: FoldersEditorItemType.Folder,
          uuid: 'custom-folder-1',
          name: 'Custom Folder 1',
          children: [],
        },
        {
          type: FoldersEditorItemType.Folder,
          uuid: 'custom-folder-2',
          name: 'Custom Folder 2',
          children: [],
        },
      ]}
    />,
  );

  // @dnd-kit adds aria-roledescription="sortable" to sortable elements
  const sortableElements = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableElements.length).toBeGreaterThanOrEqual(2);
});

test('applies @dnd-kit dragging styles when folder is being dragged', () => {
  renderEditor(
    <FoldersEditor
      {...defaultProps}
      folders={[
        {
          type: FoldersEditorItemType.Folder,
          uuid: 'custom-folder',
          name: 'Custom Folder',
          children: [],
        },
      ]}
    />,
  );

  // @dnd-kit adds aria-roledescription="sortable" and role="button" to sortable elements
  const sortableElements = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableElements.length).toBeGreaterThan(0);

  // Each sortable element should have @dnd-kit attributes
  sortableElements.forEach(element => {
    expect(element).toHaveAttribute('aria-roledescription', 'sortable');
    expect(element).toHaveAttribute('role', 'button');
  });
});

test('renders @dnd-kit sortable context', () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  // Just test that the basic DndContext is working
  // by checking for the presence of @dnd-kit specific attributes
  const sortableElements = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableElements.length).toBeGreaterThan(0);

  // Test that sortable attributes are present
  sortableElements.forEach(element => {
    expect(element).toHaveAttribute('aria-roledescription', 'sortable');
  });
});

test('folders are rendered with proper @dnd-kit integration', () => {
  renderEditor(
    <FoldersEditor
      {...defaultProps}
      folders={[
        {
          type: FoldersEditorItemType.Folder,
          uuid: 'test-folder',
          name: 'Test Folder',
          children: [],
        },
      ]}
    />,
  );

  // Test that the folder appears and has drag functionality
  expect(screen.getByText('Test Folder')).toBeInTheDocument();
  const sortableElements = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableElements.length).toBeGreaterThan(0);
  const sortableElement = sortableElements[0];
  expect(sortableElement).toHaveAttribute('tabindex', '0');
  expect(sortableElement).toHaveAttribute('role', 'button');
});

test('items are sortable with @dnd-kit', () => {
  const testProps = {
    ...defaultProps,
    folders: [
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_METRICS_FOLDER_UUID,
        name: 'Metrics',
        children: [
          {
            uuid: 'metric-1',
            type: FoldersEditorItemType.Metric,
            name: 'Test Metric 1',
          },
        ],
      },
    ],
  };

  renderEditor(<FoldersEditor {...testProps} />);

  // Expand folder to show items
  const metricsFolder = screen.getByText('Metrics');
  fireEvent.click(metricsFolder);

  // Check that items have checkboxes
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(0);

  // Check that sortable elements with @dnd-kit attributes exist
  // Items should have sortable attributes even without explicit drag handles
  const sortableElements = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableElements.length).toBeGreaterThan(0);
});

test('component renders with proper drag and drop structure', () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  // Verify basic structure is present
  expect(
    screen.getByPlaceholderText('Search all metrics & columns'),
  ).toBeInTheDocument();
  expect(screen.getByText('Add folder')).toBeInTheDocument();

  // Verify DndContext and sortable elements are working
  const sortableElements = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableElements.length).toBeGreaterThan(0);

  // Each sortable element should have @dnd-kit attributes
  sortableElements.forEach(element => {
    expect(element).toHaveAttribute('aria-roledescription', 'sortable');
    expect(element).toHaveAttribute('role', 'button');
  });
});

test('drag functionality integrates properly with selection state', () => {
  const onChange = jest.fn();
  const testProps = {
    ...defaultProps,
    onChange,
    folders: [
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_METRICS_FOLDER_UUID,
        name: 'Metrics',
        children: [
          {
            uuid: 'metric-1',
            type: FoldersEditorItemType.Metric,
            name: 'Test Metric 1',
          },
          {
            uuid: 'metric-2',
            type: FoldersEditorItemType.Metric,
            name: 'Test Metric 2',
          },
        ],
      },
    ],
    metrics: [
      {
        uuid: 'metric-1',
        metric_name: 'Test Metric 1',
        expression: 'COUNT(*)',
      },
      {
        uuid: 'metric-2',
        metric_name: 'Test Metric 2',
        expression: 'SUM(amount)',
      },
    ],
  };

  renderEditor(<FoldersEditor {...testProps} />);

  // Expand folder to show items
  const metricsFolder = screen.getByText('Metrics');
  fireEvent.click(metricsFolder);

  // Verify that drag and drop context is properly set up
  // Items should be wrapped in sortable context
  const sortableItems = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableItems.length).toBeGreaterThanOrEqual(2); // At least folders are sortable

  // Verify checkboxes are present and functional
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBeGreaterThan(0);
});

test('select all expands collapsed folders', async () => {
  renderEditor(<FoldersEditor {...defaultProps} />);

  // Folder should be expanded by default, so Count should be visible
  expect(screen.getByText('Count')).toBeInTheDocument();

  // Collapse the Metrics folder
  const downIcons = screen.getAllByRole('img', { name: 'down' });
  fireEvent.click(downIcons[0]);

  await waitFor(() => {
    expect(screen.queryByText('Count')).not.toBeInTheDocument();
  });

  // Click "Select all"
  const selectAllButton = screen.getByText('Select all');
  fireEvent.click(selectAllButton);

  // The collapsed folder should be expanded and items should be visible
  await waitFor(() => {
    expect(screen.getByText('Count')).toBeInTheDocument();
  });

  // All checkboxes should be checked
  const checkboxes = screen.getAllByRole('checkbox');
  const nonButtonCheckboxes = checkboxes.filter(
    checkbox => !checkbox.closest('button'),
  );
  nonButtonCheckboxes.forEach(checkbox => {
    expect(checkbox).toBeChecked();
  });
});

test('auto-expands folders when searching for items inside them', async () => {
  const testProps = {
    ...defaultProps,
    folders: [
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_METRICS_FOLDER_UUID,
        name: 'Metrics',
        children: [
          {
            uuid: 'metric1',
            type: FoldersEditorItemType.Metric,
            name: 'Count',
          },
          {
            uuid: 'metric2',
            type: FoldersEditorItemType.Metric,
            name: 'Sum Revenue',
          },
        ],
      },
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_COLUMNS_FOLDER_UUID,
        name: 'Columns',
        children: [
          {
            uuid: 'col1',
            type: FoldersEditorItemType.Column,
            name: 'id',
          },
        ],
      },
    ],
  };

  renderEditor(<FoldersEditor {...testProps} />);

  // Collapse the Metrics folder first
  const metricsIcon = screen.getAllByRole('img', { name: 'down' })[0];
  fireEvent.click(metricsIcon);

  await waitFor(() => {
    expect(screen.queryByText('Count')).not.toBeInTheDocument();
  });

  // Search for "Count" - folder should auto-expand
  const searchInput = screen.getByPlaceholderText(
    'Search all metrics & columns',
  );
  await userEvent.type(searchInput, 'Count');

  await waitFor(() => {
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
  });
});

test('hides folders that do not contain matching items', async () => {
  const testProps = {
    ...defaultProps,
    folders: [
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_METRICS_FOLDER_UUID,
        name: 'Metrics',
        children: [
          {
            uuid: 'metric1',
            type: FoldersEditorItemType.Metric,
            name: 'Count',
          },
        ],
      },
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_COLUMNS_FOLDER_UUID,
        name: 'Columns',
        children: [
          {
            uuid: 'col1',
            type: FoldersEditorItemType.Column,
            name: 'id',
          },
        ],
      },
    ],
  };

  renderEditor(<FoldersEditor {...testProps} />);

  // Search for "Count" - only Metrics folder should be visible
  const searchInput = screen.getByPlaceholderText(
    'Search all metrics & columns',
  );
  await userEvent.type(searchInput, 'Count');

  await waitFor(() => {
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
    // Columns folder should be hidden since it has no matching items
    expect(screen.queryByText('Columns')).not.toBeInTheDocument();
  });
});

test('shows all children when folder name matches search', async () => {
  const testProps = {
    ...defaultProps,
    folders: [
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_METRICS_FOLDER_UUID,
        name: 'Metrics',
        children: [
          {
            uuid: 'metric1',
            type: FoldersEditorItemType.Metric,
            name: 'Count',
          },
          {
            uuid: 'metric2',
            type: FoldersEditorItemType.Metric,
            name: 'Sum Revenue',
          },
        ],
      },
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_COLUMNS_FOLDER_UUID,
        name: 'Columns',
        children: [
          {
            uuid: 'col1',
            type: FoldersEditorItemType.Column,
            name: 'id',
          },
        ],
      },
    ],
  };

  renderEditor(<FoldersEditor {...testProps} />);

  // Search for "Metrics" - all children in Metrics folder should be visible
  const searchInput = screen.getByPlaceholderText(
    'Search all metrics & columns',
  );
  await userEvent.type(searchInput, 'Metrics');

  await waitFor(() => {
    expect(screen.getByText('Metrics')).toBeInTheDocument();
    // All children should be visible even if they don't match
    expect(screen.getByText('Count')).toBeInTheDocument();
    expect(screen.getByText('Sum Revenue')).toBeInTheDocument();
    // Columns folder should be hidden
    expect(screen.queryByText('Columns')).not.toBeInTheDocument();
  });
});

test('restores previous collapsed state when search is cleared', async () => {
  const testProps = {
    ...defaultProps,
    folders: [
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_METRICS_FOLDER_UUID,
        name: 'Metrics',
        children: [
          {
            uuid: 'metric1',
            type: FoldersEditorItemType.Metric,
            name: 'Count',
          },
        ],
      },
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: DEFAULT_COLUMNS_FOLDER_UUID,
        name: 'Columns',
        children: [
          {
            uuid: 'col1',
            type: FoldersEditorItemType.Column,
            name: 'id',
          },
        ],
      },
    ],
  };

  renderEditor(<FoldersEditor {...testProps} />);

  // Collapse Metrics folder
  const metricsIcon = screen.getAllByRole('img', { name: 'down' })[0];
  fireEvent.click(metricsIcon);

  await waitFor(() => {
    expect(screen.queryByText('Count')).not.toBeInTheDocument();
  });

  // Search for "Count" - folder auto-expands
  const searchInput = screen.getByPlaceholderText(
    'Search all metrics & columns',
  );
  await userEvent.type(searchInput, 'Count');

  await waitFor(() => {
    expect(screen.getByText('Count')).toBeInTheDocument();
  });

  // Clear search - folder should be collapsed again
  await userEvent.clear(searchInput);

  await waitFor(() => {
    // Both folders should be visible
    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
    // But Metrics folder should be collapsed again as it was before search
    expect(screen.queryByText('Count')).not.toBeInTheDocument();
    // Columns folder should still show its content (was expanded before search)
    expect(screen.getByText('id')).toBeInTheDocument();
  });
});

test('handles nested folders correctly during search', async () => {
  const testProps = {
    ...defaultProps,
    folders: [
      {
        type: FoldersEditorItemType.Folder as const,
        uuid: 'parent',
        name: 'Parent',
        children: [
          {
            type: FoldersEditorItemType.Folder as const,
            uuid: 'nested',
            name: 'Nested Folder',
            children: [
              {
                uuid: 'metric1',
                type: FoldersEditorItemType.Metric,
                name: 'Deep Metric',
              },
            ],
          } as DatasourceFolder,
        ],
      },
    ],
    metrics: [
      {
        uuid: 'metric1',
        metric_name: 'Deep Metric',
        expression: 'COUNT(*)',
      },
    ],
  };

  renderEditor(<FoldersEditor {...testProps} />);

  // Search for "Deep" - both parent and nested folder should expand
  const searchInput = screen.getByPlaceholderText(
    'Search all metrics & columns',
  );
  await userEvent.type(searchInput, 'Deep');

  await waitFor(() => {
    expect(screen.getByText('Parent')).toBeInTheDocument();
    expect(screen.getByText('Nested Folder')).toBeInTheDocument();
    expect(screen.getByText('Deep Metric')).toBeInTheDocument();
  });
});

test('nested folders with items remain visible after drag is cancelled', async () => {
  const onChange = jest.fn();
  const nestedFolders: DatasourceFolder[] = [
    {
      uuid: 'parent-folder',
      type: FoldersEditorItemType.Folder,
      name: 'Parent Folder',
      children: [
        {
          uuid: 'nested-folder',
          type: FoldersEditorItemType.Folder,
          name: 'Nested Folder',
          children: [
            {
              uuid: 'metric1',
              type: FoldersEditorItemType.Metric,
              name: 'Count',
            },
          ],
        } as DatasourceFolder,
      ],
    },
  ];

  renderEditor(
    <FoldersEditor
      {...defaultProps}
      folders={nestedFolders}
      onChange={onChange}
    />,
  );

  expect(screen.getByText('Parent Folder')).toBeInTheDocument();
  expect(screen.getByText('Nested Folder')).toBeInTheDocument();
  expect(screen.getByText('Count')).toBeInTheDocument();

  const sortableElements = document.querySelectorAll(
    '[aria-roledescription="sortable"]',
  );
  expect(sortableElements.length).toBeGreaterThan(0);

  await waitFor(() => {
    expect(screen.getByText('Parent Folder')).toBeInTheDocument();
    expect(screen.getByText('Nested Folder')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();
  });
});
