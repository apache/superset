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

import { render, screen } from 'spec/helpers/testing-library';
import { FlattenedTreeItem } from '../constants';
import { FoldersEditorItemType } from '../../types';
import { DragOverlayContent } from './DragOverlayContent';

// Mock TreeItem to avoid dnd-kit hook dependencies
jest.mock('../TreeItem', () => ({
  TreeItem: ({ name, id }: { name: string; id: string }) => (
    <div data-test={`tree-item-${id}`}>{name}</div>
  ),
}));

const makeItem = (
  uuid: string,
  type: FoldersEditorItemType,
  depth = 0,
  parentId: string | null = null,
): FlattenedTreeItem => ({
  uuid,
  type,
  name: uuid,
  depth,
  parentId,
  index: 0,
});

const defaultProps = {
  dragOverlayWidth: 400,
  selectedItemIds: new Set<string>(),
  metricsMap: new Map(),
  columnsMap: new Map(),
  itemSeparatorInfo: new Map(),
};

test('returns null when dragOverlayItems is empty', () => {
  const { container } = render(
    <DragOverlayContent {...defaultProps} dragOverlayItems={[]} />,
  );
  // The wrapper div rendered by testing-library's render should be empty
  expect(container.querySelector('[data-test]')).toBeNull();
});

test('renders folder block overlay for folder drag with children', () => {
  const items: FlattenedTreeItem[] = [
    makeItem('folder-1', FoldersEditorItemType.Folder, 0),
    makeItem('metric-1', FoldersEditorItemType.Metric, 1, 'folder-1'),
    makeItem('metric-2', FoldersEditorItemType.Metric, 1, 'folder-1'),
  ];

  render(<DragOverlayContent {...defaultProps} dragOverlayItems={items} />);

  expect(screen.getByTestId('tree-item-folder-1')).toBeInTheDocument();
  expect(screen.getByTestId('tree-item-metric-1')).toBeInTheDocument();
  expect(screen.getByTestId('tree-item-metric-2')).toBeInTheDocument();
  expect(screen.queryByText(/and \d+ more/)).not.toBeInTheDocument();
});

test('truncates folder overlay and shows "... and N more" for large folders', () => {
  const MAX_FOLDER_OVERLAY_CHILDREN = 8;
  const totalChildren = MAX_FOLDER_OVERLAY_CHILDREN + 5;
  const items: FlattenedTreeItem[] = [
    makeItem('folder-1', FoldersEditorItemType.Folder, 0),
    ...Array.from({ length: totalChildren }, (_, i) =>
      makeItem(`item-${i}`, FoldersEditorItemType.Metric, 1, 'folder-1'),
    ),
  ];

  render(<DragOverlayContent {...defaultProps} dragOverlayItems={items} />);

  // folder header + MAX_FOLDER_OVERLAY_CHILDREN are visible
  expect(screen.getByTestId('tree-item-folder-1')).toBeInTheDocument();
  for (let i = 0; i < MAX_FOLDER_OVERLAY_CHILDREN; i += 1) {
    expect(screen.getByTestId(`tree-item-item-${i}`)).toBeInTheDocument();
  }

  // Items beyond the limit are not rendered
  expect(
    screen.queryByTestId(`tree-item-item-${MAX_FOLDER_OVERLAY_CHILDREN}`),
  ).not.toBeInTheDocument();

  // "... and N more" indicator shown with the remaining count
  expect(screen.getByText(/and 5 more/)).toBeInTheDocument();
});

test('renders stacked overlay for single non-folder item drag', () => {
  const items: FlattenedTreeItem[] = [
    makeItem('metric-1', FoldersEditorItemType.Metric, 1, 'folder-1'),
  ];

  render(<DragOverlayContent {...defaultProps} dragOverlayItems={items} />);

  expect(screen.getByTestId('tree-item-metric-1')).toBeInTheDocument();
});

test('renders stacked overlay for folder with no children', () => {
  const items: FlattenedTreeItem[] = [
    makeItem('folder-1', FoldersEditorItemType.Folder, 0),
  ];

  render(<DragOverlayContent {...defaultProps} dragOverlayItems={items} />);

  expect(screen.getByTestId('tree-item-folder-1')).toBeInTheDocument();
  // Single folder should use the stacked overlay, not folder block
  expect(screen.queryByText(/and \d+ more/)).not.toBeInTheDocument();
});
