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
import { FoldersEditorItemType } from 'src/components/Datasource/types';
import { DndItemType } from '../DndItemType';
import { collectFolderDragItems, collectFolderIds } from './folderDrag';
import { ColumnItem, Folder, MetricItem } from './types';

const col = (name: string): ColumnItem =>
  ({
    type: FoldersEditorItemType.Column,
    uuid: name,
    name,
    column_name: name,
  }) as ColumnItem;

const met = (name: string): MetricItem =>
  ({
    type: FoldersEditorItemType.Metric,
    uuid: name,
    name,
    metric_name: name,
  }) as unknown as MetricItem;

const folder = (items: Folder['items'], subFolders?: Folder[]): Folder => ({
  id: 'f',
  name: 'F',
  isCollapsed: false,
  items,
  subFolders,
  totalItems: items.length,
  showingItems: items.length,
});

test('maps columns and metrics to their DnD item types', () => {
  const a = col('a');
  const m = met('m');
  expect(collectFolderDragItems(folder([a, m]))).toEqual([
    { type: DndItemType.Column, value: a },
    { type: DndItemType.Metric, value: m },
  ]);
});

test('descends into subfolders, preserving order (parent items first)', () => {
  const sub = folder([col('b'), met('n')]);
  const result = collectFolderDragItems(folder([col('a')], [sub]));
  expect(result.map(item => item.type)).toEqual([
    DndItemType.Column,
    DndItemType.Column,
    DndItemType.Metric,
  ]);
  expect(
    result.map(item =>
      item.type === DndItemType.Column
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item.value as any).column_name
        : // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item.value as any).metric_name,
    ),
  ).toEqual(['a', 'b', 'n']);
});

test('returns an empty list for an empty folder', () => {
  expect(collectFolderDragItems(folder([]))).toEqual([]);
});

test('collectFolderIds gathers the folder id and every subfolder id', () => {
  const sub = { ...folder([col('b')]), id: 'sub' };
  const nested = { ...folder([col('c')]), id: 'nested' };
  sub.subFolders = [nested];
  const parent = { ...folder([col('a')]), id: 'parent', subFolders: [sub] };
  expect(collectFolderIds(parent)).toEqual(['parent', 'sub', 'nested']);
});
