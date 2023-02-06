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
import { BinaryQueryObjectFilterClause } from '@superset-ui/core';
import {
  BaseTransformedProps,
  CrossFilterTransformedProps,
  EventHandlers,
} from '../types';

export type Event = {
  name: string;
  event: { stop: () => void; event: PointerEvent };
};

export const clickEventHandler =
  (
    selectedValues: Record<number, string>,
    handleChange: (values: string[]) => void,
  ) =>
  ({ name }: { name: string }) => {
    const values = Object.values(selectedValues);
    if (values.includes(name)) {
      handleChange(values.filter(v => v !== name));
    } else {
      handleChange([name]);
    }
  };

export const contextMenuEventHandler =
  (
    groupby: (BaseTransformedProps<any> &
      CrossFilterTransformedProps)['groupby'],
    onContextMenu: BaseTransformedProps<any>['onContextMenu'],
    labelMap: Record<string, string[]>,
  ) =>
  (e: Event) => {
    if (onContextMenu) {
      e.event.stop();
      const pointerEvent = e.event.event;
      const filters: BinaryQueryObjectFilterClause[] = [];
      if (groupby.length > 0) {
        const values = labelMap[e.name];
        groupby.forEach((dimension, i) =>
          filters.push({
            col: dimension,
            op: '==',
            val: values[i],
            formattedVal: String(values[i]),
          }),
        );
      }
      onContextMenu(pointerEvent.clientX, pointerEvent.clientY, filters);
    }
  };

export const allEventHandlers = (
  transformedProps: BaseTransformedProps<any> & CrossFilterTransformedProps,
  handleChange: (values: string[]) => void,
) => {
  const { groupby, selectedValues, onContextMenu, labelMap } = transformedProps;
  const eventHandlers: EventHandlers = {
    click: clickEventHandler(selectedValues, handleChange),
    contextmenu: contextMenuEventHandler(groupby, onContextMenu, labelMap),
  };
  return eventHandlers;
};
