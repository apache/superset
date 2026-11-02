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
import { useMemo } from 'react';
import {
  ContextMenuFilters,
  DataRecordValue,
  getColumnLabel,
  getNumberFormatter,
  getTimeFormatter,
  QueryFormColumn,
  QueryObjectFilterClause,
} from '@superset-ui/core';
import { BubbleChartTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import { useLegendEventHandlers } from '../utils/legendEventHandlers';
import { formatSeriesName } from '../utils/series';
import {
  BubbleDatum,
  ENTITY_INDEX,
  getBubbleCrossFilterDataMask,
  getSelectedBubbleKeys,
  isBubbleDatum,
  SERIES_INDEX,
  toJsonSafeFilterValue,
} from './crossFilter';

const noop = () => {};

type BubbleEvent = {
  componentType?: string;
  data?: unknown;
  event?: { stop: () => void; event: PointerEvent };
};

function buildDrillFilters(
  entity: QueryFormColumn,
  series: QueryFormColumn | undefined,
  datum: BubbleDatum,
  dateFormat: string | undefined,
  coltypeMapping: BubbleChartTransformedProps['coltypeMapping'],
): QueryObjectFilterClause[] {
  const columns: Array<{ col: QueryFormColumn; value: DataRecordValue }> = [
    { col: entity, value: datum[ENTITY_INDEX] },
  ];
  if (series) {
    columns.push({ col: series, value: datum[SERIES_INDEX] });
  }
  const timeFormatter = getTimeFormatter(dateFormat);
  const numberFormatter = getNumberFormatter();
  return columns.map(({ col, value }) => {
    const formattedVal = formatSeriesName(value, {
      timeFormatter,
      numberFormatter,
      coltype: coltypeMapping?.[getColumnLabel(col)],
    });
    if (value == null) {
      return { col, op: 'IS NULL' as const, formattedVal };
    }
    return {
      col,
      op: '==' as const,
      val: toJsonSafeFilterValue(value),
      formattedVal,
    };
  });
}

export default function EchartsBubble(props: BubbleChartTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    refs,
    formData,
    emitCrossFilters,
    filterState,
    setDataMask = noop,
    onContextMenu,
    coltypeMapping,
    onLegendStateChanged,
    onLegendScroll,
  } = props;
  const { entity, series, dateFormat } = formData;

  const crossFilterHandlers: EventHandlers = useMemo(() => {
    const selectedKeys = getSelectedBubbleKeys(filterState?.selectedValues);
    const seriesColumn = series || undefined;

    const crossFilterFor = (datum: BubbleDatum) =>
      getBubbleCrossFilterDataMask({
        entity,
        series: seriesColumn,
        datum,
        selectedKeys,
        coltypeMapping,
        dateFormat,
      });

    return {
      click: (event: BubbleEvent) => {
        if (!emitCrossFilters || !isBubbleDatum(event.data)) {
          return;
        }
        const { dataMask } = crossFilterFor(event.data);
        setDataMask(dataMask);
      },
      contextmenu: (event: BubbleEvent) => {
        if (!onContextMenu || !isBubbleDatum(event.data)) {
          return;
        }
        event.event?.stop();
        const pointerEvent = event.event?.event;
        if (!pointerEvent) {
          return;
        }
        // The context menu types only binary operators. IS NULL is unary, and
        // both drill paths forward `op` to the query unchanged.
        const drillFilters = buildDrillFilters(
          entity,
          seriesColumn,
          event.data,
          dateFormat,
          coltypeMapping,
        ) as NonNullable<ContextMenuFilters['drillToDetail']>;
        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillFilters,
          crossFilter: crossFilterFor(event.data),
          drillBy: {
            filters: drillFilters,
            groupbyFieldName: 'entity',
          },
        });
      },
    };
  }, [
    coltypeMapping,
    dateFormat,
    emitCrossFilters,
    entity,
    filterState?.selectedValues,
    onContextMenu,
    series,
    setDataMask,
  ]);

  const legendEventHandlers = useLegendEventHandlers(
    onLegendStateChanged,
    onLegendScroll,
  );
  const eventHandlers = {
    ...legendEventHandlers,
    ...crossFilterHandlers,
  };

  return (
    <Echart
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      refs={refs}
      vizType={formData.vizType}
    />
  );
}
