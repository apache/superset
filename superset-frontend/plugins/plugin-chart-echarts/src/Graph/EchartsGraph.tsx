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
import {
  getColumnLabel,
  getNumberFormatter,
  getTimeFormatter,
} from '@superset-ui/core';
import { EventHandlers } from '../types';
import Echart from '../components/Echart';
import { GraphChartTransformedProps } from './types';
import { formatSeriesName } from '../utils/series';

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

export default function EchartsGraph({
  height,
  width,
  echartOptions,
  formData,
  onContextMenu,
  setDataMask,
  filterState,
  emitCrossFilters,
  refs,
  coltypeMapping,
}: GraphChartTransformedProps) {
  const getCrossFilterDataMask = (node: DataRow | undefined) => {
    if (!node?.name || !node?.col) {
      return undefined;
    }
    const { name, col } = node;
    const selected = Object.values(
      filterState?.selectedValues || {},
    ) as string[];
    let values: string[];
    if (selected.includes(name)) {
      values = selected.filter(v => v !== name);
    } else {
      values = [name];
    }
    return {
      dataMask: {
        extraFormData: {
          filters: values.length
            ? [
                {
                  col,
                  op: 'IN' as const,
                  val: values,
                },
              ]
            : [],
        },
        filterState: {
          value: values.length ? values : null,
          selectedValues: values.length ? values : null,
        },
      },
      isCurrentValueSelected: selected.includes(name),
    };
  };
  const eventHandlers: EventHandlers = {
    click: (e: Event) => {
      if (!emitCrossFilters || !setDataMask) {
        return;
      }
      e.event.stop();
      const data = (echartOptions as any).series[0].data as Data;
      const node = data.find(item => item.id === e.data.id);
      const dataMask = getCrossFilterDataMask(node)?.dataMask;
      if (dataMask) {
        setDataMask(dataMask);
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
        const sourceValue = data.find(item => item.id === e.data.source)?.name;
        const targetValue = data.find(item => item.id === e.data.target)?.name;
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
        const drillToDetailFilters =
          e.dataType === 'node' ? handleNodeClick(data) : handleEdgeClick(data);
        const node = data.find(item => item.id === e.data.id);

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          crossFilter: getCrossFilterDataMask(node),
          drillBy: node && {
            filters: [
              {
                col: node.col,
                op: '==',
                val: node.name,
                formattedVal: formatSeriesName(node.name, {
                  timeFormatter: getTimeFormatter(formData.dateFormat),
                  numberFormatter: getNumberFormatter(formData.numberFormat),
                  coltype: coltypeMapping?.[getColumnLabel(node.col)],
                }),
              },
            ],
            groupbyFieldName:
              node.col === formData.source ? 'source' : 'target',
          },
        });
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
