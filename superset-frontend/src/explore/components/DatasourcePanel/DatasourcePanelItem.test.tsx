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
import {
  columns,
  metrics,
} from 'src/explore/components/DatasourcePanel/fixtures';
import { screen, userEvent, render } from 'spec/helpers/testing-library';
import DatasourcePanelItem, {
  DatasourcePanelItemProps,
} from './DatasourcePanelItem';

const mockData: DatasourcePanelItemProps['data'] = {
  flattenedItems: [
    { type: 'header', depth: 0, folderId: '1', height: 50 },
    ...metrics.map((m, idx) => ({
      type: 'item' as const,
      depth: 0,
      folderId: '1',
      height: 32,
      index: idx,
      item: { ...m, type: 'metric' as const },
    })),
    { type: 'divider', depth: 0, folderId: '1', height: 16 },
    { type: 'header', depth: 0, folderId: '2', height: 50 },
    ...columns.map((m, idx) => ({
      type: 'item' as const,
      depth: 0,
      folderId: '2',
      height: 32,
      index: idx,
      item: { ...m, type: 'column' as const },
    })),
  ],
  folderMap: new Map([
    [
      '1',
      {
        id: '1',
        isCollapsed: false,
        name: 'Metrics',
        items: metrics.map(m => ({ ...m, type: 'metric' })),
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
        items: columns.map(c => ({ ...c, type: 'column' })),
        totalItems: columns.length,
        showingItems: columns.length,
      },
    ],
  ]),
  width: 300,
  onToggleCollapse: jest.fn(),
  collapsedFolderIds: new Set(),
};

const setup = (data: DatasourcePanelItemProps['data'] = mockData) =>
  render(
    <>
      {data.flattenedItems.map((_, index) => (
        <DatasourcePanelItem index={index} data={data} style={{}} />
      ))}
    </>,
    { useDnd: true },
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
