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
import React from 'react';
import { BinaryQueryObjectFilterClause } from '@superset-ui/core';
import { EventHandlers } from '../types';
import Echart from '../components/Echart';
import { GraphChartTransformedProps } from './types';

type Event = {
  name: string;
  event: { stop: () => void; event: PointerEvent };
  data: { source: string; target: string };
};

export default function EchartsGraph({
  height,
  width,
  echartOptions,
  formData,
  onContextMenu,
  refs,
}: GraphChartTransformedProps) {
  const eventHandlers: EventHandlers = {
    contextmenu: (e: Event) => {
      if (onContextMenu) {
        e.event.stop();
        const pointerEvent = e.event.event;
        const data = (echartOptions as any).series[0].data as {
          id: string;
          name: string;
        }[];
        const sourceValue = data.find(item => item.id === e.data.source)?.name;
        const targetValue = data.find(item => item.id === e.data.target)?.name;
        if (sourceValue && targetValue) {
          const filters: BinaryQueryObjectFilterClause[] = [
            {
              col: formData.source,
              op: '==',
              val: sourceValue,
              formattedVal: sourceValue,
            },
            {
              col: formData.target,
              op: '==',
              val: targetValue,
              formattedVal: targetValue,
            },
          ];
          onContextMenu(pointerEvent.clientX, pointerEvent.clientY, filters);
        }
      }
    },
  };
  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
    />
  );
}
