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
import { useDraggable } from '@dnd-kit/core';
import {
  columns,
  metrics,
} from 'src/explore/components/DatasourcePanel/fixtures';
import { screen, userEvent, render } from 'spec/helpers/testing-library';
import DatasourcePanelItem, {
  DatasourcePanelItemRowProps,
} from './DatasourcePanelItem';
import { FoldersEditorItemType } from 'src/components/Datasource/types';
import { DndItemType } from '../DndItemType';
import { MetricItem, ColumnItem } from './types';

jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  useDraggable: jest.fn(),
}));

const mockUseDraggable = useDraggable as jest.Mock;
const actualUseDraggable = jest.requireActual('@dnd-kit/core').useDraggable;

const mockData: DatasourcePanelItemRowProps = {
  flattenedItems: [
    { type: 'header', depth: 0, folderId: '1', height: 50 },
    ...metrics.map((m, idx) => ({
      type: 'item' as const,
      depth: 0,
      folderId: '1',
      height: 32,
      index: idx,
      item: { ...m, type: FoldersEditorItemType.Metric } as MetricItem,
    })),
    { type: 'divider', depth: 0, folderId: '1', height: 16 },
    { type: 'header', depth: 0, folderId: '2', height: 50 },
    ...columns.map((m, idx) => ({
      type: 'item' as const,
      depth: 0,
      folderId: '2',
      height: 32,
      index: idx,
      item: { ...m, type: FoldersEditorItemType.Column } as ColumnItem,
    })),
  ],
  folderMap: new Map([
    [
      '1',
      {
        id: '1',
        isCollapsed: false,
        name: 'Metrics',
        items: metrics.map(
          m => ({ ...m, type: FoldersEditorItemType.Metric }) as MetricItem,
        ),
        totalItems: metrics.length,
        showingItems: metrics.length,
      },
    ],
    [
      '2',
      {
        id: '2',
        isCollapsed: false,
        name: 'Columns',
        items: columns.map(
          c => ({ ...c, type: FoldersEditorItemType.Column }) as ColumnItem,
        ),
        totalItems: columns.length,
        showingItems: columns.length,
      },
    ],
  ]),
  width: 300,
  onToggleCollapse: jest.fn(),
  collapsedFolderIds: new Set(),
};

beforeEach(() => {
  mockUseDraggable.mockReset();
  mockUseDraggable.mockImplementation(actualUseDraggable);
});

const setup = (
  data: DatasourcePanelItemRowProps = mockData,
  initialState: Record<string, unknown> = { explore: {} },
) =>
  render(
    <>
      {data.flattenedItems.map((_, index) => (
        <DatasourcePanelItem
          // eslint-disable-next-line react/no-array-index-key -- test fixture has no stable id
          key={index}
          index={index}
          style={{}}
          ariaAttributes={{
            role: 'listitem',
            'aria-posinset': index + 1,
            'aria-setsize': data.flattenedItems.length,
          }}
          {...data}
        />
      ))}
    </>,
    { useDnd: true, useRedux: true, initialState },
  );

test('renders each item accordingly', () => {
  setup();
  expect(screen.getByText('Metrics')).toBeInTheDocument();
  expect(screen.getByText('metric_end_certified')).toBeInTheDocument();
  expect(screen.getByText('metric_end')).toBeInTheDocument();

  expect(screen.getByText('Columns')).toBeInTheDocument();
  expect(screen.getByText('bootcamp_attend')).toBeInTheDocument();
  expect(screen.getByText('calc_first_time_dev')).toBeInTheDocument();
  expect(screen.getByText('aaaaaaaaaaa')).toBeInTheDocument();

  expect(screen.getByTestId('datasource-panel-divider')).toBeInTheDocument();
  expect(screen.getAllByTestId('DatasourcePanelDragOption').length).toEqual(5);
});

test('can collapse metrics and columns', () => {
  setup();
  userEvent.click(screen.getAllByRole('button')[0]);
  expect(mockData.onToggleCollapse).toHaveBeenCalled();
});

test('folder drag handle is a separate element from the collapse toggle', () => {
  setup();

  const toggleButtons = screen
    .getAllByRole('button', { name: /Metrics/ })
    .filter(el => el.tagName === 'BUTTON');
  expect(toggleButtons).toHaveLength(1);
  const [toggleButton] = toggleButtons;
  const dragHandle = screen.getByRole('button', {
    name: 'Drag Metrics folder',
  });

  expect(toggleButton).not.toBe(dragHandle);
  expect(toggleButton.tagName).toBe('BUTTON');

  userEvent.click(toggleButton);
  expect(mockData.onToggleCollapse).toHaveBeenCalledWith('1');
});

test('folder drag payload excludes columns filtered out by compatibleDimensions', () => {
  setup(mockData, {
    explore: { compatibleDimensions: [columns[0].column_name] },
  });

  const folderHeaderCalls = mockUseDraggable.mock.calls.filter(
    ([opts]) => opts.data.type === DndItemType.Folder,
  );
  const columnsFolderCall = folderHeaderCalls.find(
    ([opts]) => opts.data.name === 'Columns',
  );

  expect(columnsFolderCall![0].data.items).toEqual([
    expect.objectContaining({
      type: DndItemType.Column,
      value: expect.objectContaining({ column_name: columns[0].column_name }),
    }),
  ]);
  expect(columnsFolderCall![0].disabled).toBe(false);
});

test('folder header is not draggable when every item is filtered out', () => {
  setup(mockData, {
    explore: { compatibleDimensions: ['non-existent-column'] },
  });

  const folderHeaderCalls = mockUseDraggable.mock.calls.filter(
    ([opts]) => opts.data.type === DndItemType.Folder,
  );
  const columnsFolderCall = folderHeaderCalls.find(
    ([opts]) => opts.data.name === 'Columns',
  );

  expect(columnsFolderCall![0].data.items).toEqual([]);
  expect(columnsFolderCall![0].disabled).toBe(true);
});
