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
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';
import { useRef, FC } from 'react';
import {
  DragSourceMonitor,
  DropTargetMonitor,
  useDrag,
  useDrop,
  XYCoord,
} from 'react-dnd';
import { Icons } from '@superset-ui/core/components/Icons';
import type { IconType } from '@superset-ui/core/components/Icons/types';
import { isDivider } from './utils';

interface TitleContainerProps {
  readonly isDragging: boolean;
}

export const FILTER_TYPE = 'FILTER';
export const CUSTOMIZATION_TYPE = 'CUSTOMIZATION';

const Container = styled.div<TitleContainerProps>`
  ${({ isDragging }) => `
    opacity: ${isDragging ? 0.3 : 1};
    cursor: ${isDragging ? 'grabbing' : 'pointer'};
    width: 100%;
    display: flex;
  `}
`;

const DragIcon = styled(Icons.Drag, {
  shouldForwardProp: propName => propName !== 'isDragging',
})<IconType & { isDragging: boolean }>`
  ${({ isDragging, theme }) => `
    font-size: ${theme.fontSize}px;
    cursor: ${isDragging ? 'grabbing' : 'grab'};
    padding-left: ${theme.sizeUnit}px;
  `}
`;

interface FilterTabTitleProps {
  index: number;
  filterIds: string[];
  onRearrange: (
    dragItemIndex: number,
    targetIndex: number,
    itemId: string,
  ) => void;
  onCrossListDrop?: (
    sourceId: string,
    targetIndex: number,
    sourceType: 'filter' | 'customization',
  ) => void;
  dragType?: string;
}

interface DragItem {
  index: number;
  filterIds: string[];
  type: string;
  isDivider: boolean;
  dragType: string;
}

export const DraggableFilter: FC<FilterTabTitleProps> = ({
  index,
  onRearrange,
  onCrossListDrop,
  filterIds,
  dragType = FILTER_TYPE,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const itemId = filterIds[0];
  const isDividerItem = isDivider(itemId);

  const [{ isDragging }, drag] = useDrag({
    item: {
      filterIds,
      type: dragType,
      index,
      isDivider: isDividerItem,
      dragType,
    },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: [FILTER_TYPE, CUSTOMIZATION_TYPE],
    drop: (item: DragItem) => {
      const isCrossListDrop = item.dragType !== dragType;

      if (isCrossListDrop && item.isDivider && onCrossListDrop) {
        const sourceType: 'filter' | 'customization' =
          item.dragType === FILTER_TYPE ? 'filter' : 'customization';
        onCrossListDrop(item.filterIds[0], index, sourceType);
      }
    },
    hover: (item: DragItem, monitor: DropTargetMonitor) => {
      if (!ref.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = index;

      if (dragIndex === hoverIndex && item.dragType === dragType) {
        return;
      }

      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      const isCrossListDrop = item.dragType !== dragType;

      if (isCrossListDrop) {
        return;
      }

      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      onRearrange(dragIndex, hoverIndex, item.filterIds[0]);
      item.index = hoverIndex;
    },
  });
  drag(drop(ref));
  return (
    <Container ref={ref} isDragging={isDragging}>
      <DragIcon
        isDragging={isDragging}
        alt={t('Move')}
        className="dragIcon"
        viewBox="4 4 16 16"
      />
      <div css={{ flex: 1 }}>{children}</div>
    </Container>
  );
};

export default DraggableFilter;
