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
import { UniqueIdentifier } from '@dnd-kit/core';
import { Metric, ColumnMeta } from '@superset-ui/chart-controls';
import { DatasourceFolder } from 'src/explore/components/DatasourcePanel/types';

export interface FoldersEditorProps {
  folders: DatasourceFolder[];
  metrics: Metric[];
  columns: ColumnMeta[];
  onChange: (folders: DatasourceFolder[]) => void;
  isEditMode: boolean;
}

export interface DragState {
  activeId: UniqueIdentifier | null;
  draggedType: 'folder' | 'item' | null;
  draggedItems: string[];
  overId: UniqueIdentifier | null;
}

export interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  isDragging?: boolean;
  onSelect: (selected: boolean) => void;
  isSelected: boolean;
}

export interface SortableFolderProps {
  folder: DatasourceFolder;
  isExpanded: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onNameChange: (name: string) => void;
  isDragOver: boolean;
  canAcceptDrop: boolean;
  visibleItemIds: Set<string>;
  children: React.ReactNode;
  isNested?: boolean;
}
