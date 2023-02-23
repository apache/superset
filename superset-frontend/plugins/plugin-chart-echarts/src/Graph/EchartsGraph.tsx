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
import React, { useMemo } from 'react';
import { EventHandlers } from '../types';
import Echart from '../components/Echart';
import { GraphChartTransformedProps } from './types';

type DataRow = {
  source?: string;
  target?: string;
  id?: string;
  col: string;
  name: string;
};
type Data = DataRow[];
type Event = {
  name: string;
  event: { stop: () => void; event: PointerEvent };
  data: DataRow;
  dataType: 'node' | 'edge';
};

const EchartsGraph = React.memo(
  ({
    height,
    width,
    echartOptions,
    formData,
    onContextMenu,
    setDataMask,
    filterState,
    refs,
    emitCrossFilters,
  }: GraphChartTransformedProps) => {
    const eventHandlers: EventHandlers = useMemo(
      () => ({
        click: (e: Event) => {
          if (!emitCrossFilters || !setDataMask) {
            return;
          }
          e.event.stop();
          const data = (echartOptions as any).series[0].data as Data;
          const node = data.find(item => item.id === e.data.id);
          const val = filterState?.value === node?.name ? null : node?.name;
          if (node?.col) {
            setDataMask({
              extraFormData: {
                filters: val
                  ? [
                      {
                        col: node.col,
                        op: '==',
                        val,
                      },
                    ]
                  : [],
              },
              filterState: {
                value: val,
                selectedValues: [val],
              },
            });
          }
        },
        contextmenu: (e: Event) => {
          const handleNodeClick = (data: Data) => {
            const node = data.find(item => item.id === e.data.id);
            if (node?.name) {
              return [
                {
                  col: node.col,
                  op: '==' as const,
                  val: node.name,
                  formattedVal: node.name,
                },
              ];
            }
            return undefined;
          };
          const handleEdgeClick = (data: Data) => {
            const sourceValue = data.find(
              item => item.id === e.data.source,
            )?.name;
            const targetValue = data.find(
              item => item.id === e.data.target,
            )?.name;
            if (sourceValue && targetValue) {
              return [
                {
                  col: formData.source,
                  op: '==' as const,
                  val: sourceValue,
                  formattedVal: sourceValue,
                },
                {
                  col: formData.target,
                  op: '==' as const,
                  val: targetValue,
                  formattedVal: targetValue,
                },
              ];
            }
            return undefined;
          };
          if (onContextMenu) {
            e.event.stop();
            const pointerEvent = e.event.event;
            const data = (echartOptions as any).series[0].data as Data;
            const filters =
              e.dataType === 'node'
                ? handleNodeClick(data)
                : handleEdgeClick(data);

            if (filters) {
              onContextMenu(
                pointerEvent.clientX,
                pointerEvent.clientY,
                filters,
              );
            }
          }
        },
      }),
      [
        echartOptions,
        emitCrossFilters,
        filterState?.value,
        formData.source,
        formData.target,
        onContextMenu,
        setDataMask,
      ],
    );
    return (
      <Echart
        refs={refs}
        height={height}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
      />
    );
  },
);

export default EchartsGraph;
