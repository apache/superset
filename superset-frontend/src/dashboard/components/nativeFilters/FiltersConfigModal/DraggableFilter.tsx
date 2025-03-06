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
import { styled } from '@superset-ui/core';
import { useRef, FC } from 'react';
import {
  DragSourceMonitor,
  DropTargetMonitor,
  useDrag,
  useDrop,
  XYCoord,
} from 'react-dnd';
import Icons, { IconType } from 'src/components/Icons';

interface TitleContainerProps {
  readonly isDragging: boolean;
}

const FILTER_TYPE = 'FILTER';

const Container = styled.div<TitleContainerProps>`
  ${({ isDragging, theme }) => `
    opacity: ${isDragging ? 0.3 : 1};
    cursor: ${isDragging ? 'grabbing' : 'pointer'};
    width: 100%;
    display: flex;
    padding:  ${theme.gridUnit}px;
  `}
`;

const DragIcon = styled(Icons.Drag, {
  shouldForwardProp: propName => propName !== 'isDragging',
})<IconType & { isDragging: boolean }>`
  ${({ isDragging, theme }) => `
    font-size: ${theme.typography.sizes.m}px;
    margin-top: 15px;
    cursor: ${isDragging ? 'grabbing' : 'grab'};
    padding-left: ${theme.gridUnit}px;
  `}
`;

interface FilterTabTitleProps {
  index: number;
  filterIds: string[];
  onRearrange: (dragItemIndex: number, targetIndex: number) => void;
}

interface DragItem {
  index: number;
  filterIds: string[];
  type: string;
}

export const DraggableFilter: FC<FilterTabTitleProps> = ({
  index,
  onRearrange,
  filterIds,
  children,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag({
    item: { filterIds, type: FILTER_TYPE, index },
    collect: (monitor: DragSourceMonitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  const [, drop] = useDrop({
    accept: FILTER_TYPE,
    hover: (item: DragItem, monitor: DropTargetMonitor) => {
      if (!ref.current) {
        return;
      }

      const dragIndex = item.index;
      const hoverIndex = index;

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();

      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

      // Determine mouse position
      const clientOffset = monitor.getClientOffset();

      // Get pixels to the top
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      onRearrange(dragIndex, hoverIndex);
      // Note: we're mutating the monitor item here.
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      // eslint-disable-next-line no-param-reassign
      item.index = hoverIndex;
    },
  });
  drag(drop(ref));
  return (
    <Container ref={ref} isDragging={isDragging}>
      <DragIcon
        isDragging={isDragging}
        alt="Move icon"
        className="dragIcon"
        viewBox="4 4 16 16"
      />
      <div css={{ flex: 1 }}>{children}</div>
    </Container>
  );
};

export default DraggableFilter;
