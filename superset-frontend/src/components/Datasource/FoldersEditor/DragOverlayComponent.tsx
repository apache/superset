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
import { Icons } from '@superset-ui/core/components';
import { Metric } from '@superset-ui/chart-controls';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';
import { DragOverlayContent, DragBadge } from './styles';
import { Column, DragState } from './types';

interface DragOverlayComponentProps {
  dragState: DragState;
  folders: DatasourceFolder[];
  metrics: Metric[];
  columns: Column[];
}

const DragOverlayComponent = ({
  dragState,
  folders,
  metrics,
  columns,
}: DragOverlayComponentProps) => {
  if (!dragState.activeId) return null;

  if (dragState.draggedType === 'folder') {
    const folder = folders.find(f => f.uuid === dragState.activeId);
    if (folder) {
      return (
        <DragOverlayContent>
          <Icons.FolderOutlined />
          <span>{folder.name}</span>
        </DragOverlayContent>
      );
    }
  }

  if (dragState.draggedType === 'item' && dragState.draggedItems.length > 0) {
    const itemId = dragState.draggedItems[0];
    const metric = metrics.find(m => m.uuid === itemId);
    const column = columns.find(c => c.uuid === itemId);

    if (metric) {
      return (
        <DragOverlayContent>
          <span style={{ fontStyle: 'italic', fontSize: '14px' }}>ƒₓ</span>
          <span>{metric.metric_name}</span>
          {dragState.draggedItems.length > 1 && (
            <DragBadge>{dragState.draggedItems.length}</DragBadge>
          )}
        </DragOverlayContent>
      );
    }
    if (column) {
      return (
        <DragOverlayContent>
          <Icons.FieldNumberOutlined />
          <span>{column.column_name}</span>
          {dragState.draggedItems.length > 1 && (
            <DragBadge>{dragState.draggedItems.length}</DragBadge>
          )}
        </DragOverlayContent>
      );
    }
  }

  return null;
};

export default DragOverlayComponent;
