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
import { useRef } from 'react';
import {
  BinaryQueryObjectFilterClause,
  TimeGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import Echart from '../components/Echart';
import { EchartsHandler, EventHandlers } from '../types';
import { CandlestickChartTransformedProps } from './types';

type ContextMenuEvent = {
  event?: { stop?: () => void; event?: PointerEvent };
  dataIndex?: number;
  seriesName?: string;
  seriesType?: string;
};

function toFilterValue(value: unknown): string | number | boolean | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.valueOf();
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return String(value);
}

function toFilterClause(
  col: string,
  value: unknown,
  formattedVal: string,
  grain?: TimeGranularity,
): BinaryQueryObjectFilterClause {
  return {
    col,
    op: '==',
    val: toFilterValue(value),
    formattedVal,
    ...(grain ? { grain } : {}),
  };
}

export default function EchartsCandlestick(
  props: CandlestickChartTransformedProps,
) {
  const {
    height,
    width,
    echartOptions,
    refs,
    onLegendStateChanged,
    onContextMenu,
    formData,
    coltypeMapping,
    xAxisColumn,
    seriesColumn,
    xValues,
    xLabels,
    seriesValues,
  } = props;
  const echartRef = useRef<EchartsHandler | null>(null);
  // eslint-disable-next-line no-param-reassign
  refs.echartRef = echartRef;

  const hideTooltip = () => {
    echartRef.current?.getEchartInstance()?.dispatchAction({ type: 'hideTip' });
  };

  const eventHandlers: EventHandlers = {
    legendselectchanged: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendselectall: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendinverseselect: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    contextmenu: (eventParams: ContextMenuEvent) => {
      if (!onContextMenu) {
        return;
      }
      eventParams.event?.stop?.();
      hideTooltip();
      const pointerEvent = eventParams.event?.event;
      if (!pointerEvent) {
        return;
      }
      const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
      const categoryIndex = eventParams.dataIndex;
      if (
        xAxisColumn &&
        categoryIndex != null &&
        categoryIndex >= 0 &&
        categoryIndex < xValues.length
      ) {
        const xValue = xValues[categoryIndex];
        const isTemporal =
          coltypeMapping?.[xAxisColumn] === GenericDataType.Temporal;
        drillToDetailFilters.push(
          toFilterClause(
            xAxisColumn,
            xValue,
            xLabels[categoryIndex] ?? String(xValue ?? ''),
            isTemporal
              ? (formData.timeGrainSqla as TimeGranularity | undefined)
              : undefined,
          ),
        );
      }
      if (seriesColumn && eventParams.seriesType !== 'line') {
        const seriesValue = seriesValues.find(
          item => item.name === eventParams.seriesName,
        )?.value;
        if (seriesValue !== undefined) {
          drillToDetailFilters.push(
            toFilterClause(
              seriesColumn,
              seriesValue,
              String(eventParams.seriesName ?? ''),
            ),
          );
        }
      }
      onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
        drillToDetail: drillToDetailFilters,
      });
    },
  };

  return (
    <Echart
      ref={echartRef}
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      vizType={formData.vizType}
    />
  );
}
