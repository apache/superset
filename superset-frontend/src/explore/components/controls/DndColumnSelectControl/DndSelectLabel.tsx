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
import { ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { t } from '@apache-superset/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import {
  AddControlLabel,
  DndLabelsContainer,
  HeaderContainer,
} from 'src/explore/components/controls/OptionControls';
import {
  DatasourcePanelDndItem,
  DndItemValue,
} from 'src/explore/components/DatasourcePanel/types';
import { Icons } from '@superset-ui/core/components/Icons';
import { DndItemType } from '../../DndItemType';
import { DraggingContext, DropzoneContext } from '../../ExploreContainer';

export type DndSelectLabelProps = {
  name: string;
  accept: DndItemType | DndItemType[];
  ghostButtonText: string;
  onDrop: (item: DatasourcePanelDndItem) => void;
  canDrop: (item: DatasourcePanelDndItem) => boolean;
  canDropValue?: (value: DndItemValue) => boolean;
  onDropValue?: (value: DndItemValue) => void;
  valuesRenderer: () => ReactNode;
  displayGhostButton?: boolean;
  onClickGhostButton: () => void;
  isLoading?: boolean;
  // For sortable items - the type string and count to generate sortable IDs
  sortableType?: string;
  itemCount?: number;
};

export default function DndSelectLabel({
  displayGhostButton = true,
  accept,
  valuesRenderer,
  isLoading,
  sortableType,
  itemCount = 0,
  ...props
}: DndSelectLabelProps) {
  const canDropProp = props.canDrop;
  const canDropValueProp = props.canDropValue;

  const acceptTypes = useMemo(
    () => (Array.isArray(accept) ? accept : [accept]),
    [accept],
  );

  const dropValidator = useCallback(
    (item: DatasourcePanelDndItem) =>
      canDropProp(item) && (canDropValueProp?.(item.value) ?? true),
    [canDropProp, canDropValueProp],
  );

  const { setNodeRef, isOver, active } = useDroppable({
    id: `dropzone-${props.name}`,
    disabled: isLoading,
    data: {
      accept: acceptTypes,
      onDrop: props.onDrop,
      onDropValue: props.onDropValue,
    },
  });

  // Check if the active dragged item can be dropped here
  const canDrop = useMemo(() => {
    if (!active?.data.current) return false;
    const activeData = active.data.current as { type: string; value: unknown };
    if (!acceptTypes.includes(activeData.type as DndItemType)) return false;
    return dropValidator({
      type: activeData.type as DndItemType,
      value: activeData.value as DndItemValue,
    });
  }, [active, acceptTypes, dropValidator]);

  const dispatch = useContext(DropzoneContext)[1];

  useEffect(() => {
    dispatch({ key: props.name, canDrop: dropValidator });
    return () => {
      dispatch({ key: props.name });
    };
  }, [dispatch, props.name, dropValidator]);

  const isDragging = useContext(DraggingContext);

  const values = useMemo(() => valuesRenderer(), [valuesRenderer]);

  // Generate sortable item IDs for SortableContext
  const sortableItemIds = useMemo(() => {
    if (!sortableType || itemCount === 0) return [];
    return Array.from(
      { length: itemCount },
      (_, i) => `sortable-${sortableType}-${i}`,
    );
  }, [sortableType, itemCount]);

  function renderGhostButton() {
    return (
      <AddControlLabel
        cancelHover={!props.onClickGhostButton}
        onClick={props.onClickGhostButton}
      >
        <Icons.PlusOutlined iconSize="m" />
        {t(props.ghostButtonText)}
      </AddControlLabel>
    );
  }

  // Handle drop events from dnd-kit
  useEffect(() => {
    if (isOver && active?.data.current && canDrop) {
      // The actual drop is handled in ExploreDndContext's onDragEnd
      // This effect is for any side effects needed during hover
    }
  }, [isOver, active, canDrop]);

  // Wrap values in SortableContext if sortable
  const renderSortableValues = () => {
    if (sortableItemIds.length > 0) {
      return (
        <SortableContext
          items={sortableItemIds}
          strategy={verticalListSortingStrategy}
        >
          {values}
        </SortableContext>
      );
    }
    return values;
  };

  return (
    <div ref={setNodeRef}>
      <HeaderContainer>
        <ControlHeader {...props} />
      </HeaderContainer>
      <DndLabelsContainer
        data-test="dnd-labels-container"
        canDrop={canDrop}
        isOver={isOver}
        isDragging={isDragging}
        isLoading={isLoading}
      >
        {renderSortableValues()}
        {displayGhostButton && renderGhostButton()}
      </DndLabelsContainer>
    </div>
  );
}
