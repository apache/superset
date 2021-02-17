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
import React, { useRef } from 'react';
import { useDrag, useDrop, DropTargetMonitor } from 'react-dnd';
import { DragContainer } from 'src/explore/components/OptionControls';
import Option from './Option';
import {
  OptionWrapperProps,
  GroupByItemInterface,
  GroupByItemType,
} from '../types';

export default function OptionWrapper(props: OptionWrapperProps) {
  const { groupByValues, column, onChangeGroupByValues } = props;
  const ref = useRef<HTMLDivElement>(null);

  const item: GroupByItemInterface = {
    dragIndex: groupByValues.indexOf(column.column_name),
    dropIndex: -1,
    type: GroupByItemType,
  };
  const [, drag] = useDrag({
    item,
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: GroupByItemType,

    drop: (item: GroupByItemInterface) => {
      if (item.dragIndex > -1 && item.dropIndex > -1) {
        const newValues = [...props.groupByValues];
        newValues[item.dragIndex] = groupByValues[item.dropIndex];
        newValues[item.dropIndex] = groupByValues[item.dragIndex];
        onChangeGroupByValues(newValues);
      }
    },

    hover(item: GroupByItemInterface, monitor: DropTargetMonitor) {
      if (!ref.current) {
        return;
      }
      const { dragIndex } = item;
      const hoverIndex = groupByValues.indexOf(column.column_name);

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
      const hoverClientY = clientOffset?.y
        ? clientOffset?.y - hoverBoundingRect.top
        : 0;
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
      // Time to actually perform the action
      // eslint-disable-next-line no-param-reassign
      item.dragIndex = dragIndex;
      item.dropIndex = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <DragContainer ref={ref}>
      <Option {...props} />
    </DragContainer>
  );
}
