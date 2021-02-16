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
import DropItemOption from './Option';
import { DragContainer } from 'src/explore/components/OptionControls';
import { OptionWrapperProps, GroupByItemInterface, GroupByItemType } from "../types";

export default function OptionWrapper(props: OptionWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [, drag] = useDrag({
    item: { column: props.column, type: GroupByItemType },
  })
  const [, drop] = useDrop({
    accept: GroupByItemType,

    drop: (item: GroupByItemInterface) => {
    },

    hover(item: GroupByItemInterface, monitor: DropTargetMonitor) {
      // if (!ref.current) {
      //   return;
      // }
      // const dragIndex = item.index;
      // const hoverIndex = index;
      // // Don't replace items with themselves
      // if (dragIndex === hoverIndex) {
      //   return;
      // }
      // // Determine rectangle on screen
      // const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // // Get vertical middle
      // const hoverMiddleY =
      //   (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // // Determine mouse position
      // const clientOffset = monitor.getClientOffset();
      // // Get pixels to the top
      // const hoverClientY = clientOffset?.y
      //   ? clientOffset?.y - hoverBoundingRect.top
      //   : 0;
      // // Only perform the move when the mouse has crossed half of the items height
      // // When dragging downwards, only move when the cursor is below 50%
      // // When dragging upwards, only move when the cursor is above 50%
      // // Dragging downwards
      // if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
      //   return;
      // }
      // // Dragging upwards
      // if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
      //   return;
      // }
      // // Time to actually perform the action
      // // onMoveLabel?.(dragIndex, hoverIndex);
      // // Note: we're mutating the monitor item here!
      // // Generally it's better to avoid mutations,
      // // but it's good here for the sake of performance
      // // to avoid expensive index searches.
      // // eslint-disable-next-line no-param-reassign
      // item.index = hoverIndex;
    },
  })

  drag(drop(ref));

  return <DragContainer ref={ref}><DropItemOption {...props} /></DragContainer>
}
