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
import { Checkbox } from '@superset-ui/core/components';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FolderItem } from './styles';
import { SortableItemProps } from './types';

const SortableItem = ({
  id,
  children,
  isDragging,
  onSelect,
  isSelected,
}: SortableItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id,
      data: {
        type: 'item',
      },
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <FolderItem isDraggable isDragging={isDragging}>
        <Checkbox
          checked={isSelected}
          onChange={(e: any) => {
            e.stopPropagation();
            onSelect(e.target.checked);
          }}
          onClick={(e: any) => e.stopPropagation()}
        />
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {children}
        </div>
      </FolderItem>
    </div>
  );
};

export default SortableItem;
