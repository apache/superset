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

import { memo } from 'react';
import { Metric } from '@superset-ui/core';
import { ColumnMeta } from '@superset-ui/chart-controls';
import { FoldersEditorItemType } from '../../types';
import { FlattenedTreeItem } from '../constants';
import { TreeItem } from '../TreeItem';
import { DragOverlayStack, DragOverlayItem } from '../styles';

interface DragOverlayContentProps {
  dragOverlayItems: FlattenedTreeItem[];
  dragOverlayWidth: number | null;
  selectedItemIds: Set<string>;
  metricsMap: Map<string, Metric>;
  columnsMap: Map<string, ColumnMeta>;
}

function DragOverlayContentInner({
  dragOverlayItems,
  dragOverlayWidth,
  selectedItemIds,
  metricsMap,
  columnsMap,
}: DragOverlayContentProps) {
  if (dragOverlayItems.length === 0) {
    return null;
  }

  return (
    <DragOverlayStack width={dragOverlayWidth ?? undefined}>
      {[...dragOverlayItems].reverse().map((item, index) => {
        const stackIndex = dragOverlayItems.length - 1 - index;
        return (
          <DragOverlayItem
            key={item.uuid}
            stackIndex={stackIndex}
            totalItems={dragOverlayItems.length}
          >
            <TreeItem
              id={item.uuid}
              type={item.type}
              name={item.name}
              depth={0}
              isFolder={item.type === FoldersEditorItemType.Folder}
              isOverlay
              isSelected={selectedItemIds.has(item.uuid)}
              metric={metricsMap.get(item.uuid)}
              column={columnsMap.get(item.uuid)}
            />
          </DragOverlayItem>
        );
      })}
    </DragOverlayStack>
  );
}

export const DragOverlayContent = memo(DragOverlayContentInner);
