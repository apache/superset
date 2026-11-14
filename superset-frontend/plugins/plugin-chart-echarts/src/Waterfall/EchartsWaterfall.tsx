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
  getColumnLabel,
  TimeGranularity,
} from '@superset-ui/core';
import Echart from '../components/Echart';
import { WaterfallChartTransformedProps } from './types';
import { EventHandlers } from '../types';
import { useLegendEventHandlers } from '../utils/legendEventHandlers';
import {
  getSelectedWaterfallKeys,
  getWaterfallCrossFilterDataMask,
  getWaterfallDrillFilters,
} from './crossFilter';

const noop = () => {};

type WaterfallBarEvent = {
  dataIndex?: number;
  event?: { stop: () => void; event: PointerEvent };
};

export default function EchartsWaterfall(
  props: WaterfallChartTransformedProps,
) {
  const {
    categories,
    coltypeMapping,
    echartOptions,
    emitCrossFilters,
    filterState,
    formData,
    height,
    onContextMenu,
    onLegendStateChanged,
    refs,
    setDataMask = noop,
    width,
  } = props;
  const { xAxisTimeFormat } = formData;
  const timeGrain: TimeGranularity | undefined =
    formData.extraFormData?.time_grain_sqla ?? formData.timeGrainSqla;

  // The waterfall legend has a fixed set of three entries, so it never
  // paginates and has no scroll position to preserve.
  const legendEventHandlers = useLegendEventHandlers(onLegendStateChanged);

  const crossFilterHandlers: EventHandlers = useMemo(() => {
    const selectedKeys = getSelectedWaterfallKeys(filterState?.selectedValues);
    const categoryAt = (event: WaterfallBarEvent) => {
      if (event.dataIndex == null) {
        return undefined;
      }
      const category = categories[event.dataIndex];
      if (!category || category.isGrandTotal) {
        return undefined;
      }
      return category;
    };

    return {
      click: (event: WaterfallBarEvent) => {
        if (!emitCrossFilters) {
          return;
        }
        const category = categoryAt(event);
        if (!category) {
          return;
        }
        setDataMask(
          getWaterfallCrossFilterDataMask({
            category,
            selectedKeys,
            coltypeMapping,
            timeFormat: xAxisTimeFormat,
            timeGrain,
          }).dataMask,
        );
      },
      contextmenu: (event: WaterfallBarEvent) => {
        if (!onContextMenu) {
          return;
        }
        const category = categoryAt(event);
        if (!category) {
          return;
        }
        event.event?.stop();
        const pointerEvent = event.event?.event;
        if (!pointerEvent) {
          return;
        }
        // IS NULL is unary. The menu types only binary operators, and both
        // drill paths forward `op` unchanged.
        const drillFilters = getWaterfallDrillFilters({
          category,
          coltypeMapping,
          timeFormat: xAxisTimeFormat,
          timeGrain,
        }) as NonNullable<ContextMenuFilters['drillToDetail']>;
        const xColumnLabel = getColumnLabel(category.xColumn);
        const xAxisFilters = drillFilters.filter(
          filter => getColumnLabel(filter.col) === xColumnLabel,
        );
        const breakdownFilters = drillFilters.filter(
          filter => getColumnLabel(filter.col) !== xColumnLabel,
        );
        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillFilters,
          crossFilter: getWaterfallCrossFilterDataMask({
            category,
            selectedKeys,
            coltypeMapping,
            timeFormat: xAxisTimeFormat,
            timeGrain,
          }),
          drillBy: {
            filters: breakdownFilters,
            groupbyFieldName: 'groupby',
            xAxisFilters,
          },
        });
      },
    };
  }, [
    categories,
    coltypeMapping,
    emitCrossFilters,
    filterState?.selectedValues,
    onContextMenu,
    setDataMask,
    timeGrain,
    xAxisTimeFormat,
  ]);

  const eventHandlers: EventHandlers = {
    ...legendEventHandlers,
    ...crossFilterHandlers,
  };

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      vizType={formData.vizType}
    />
  );
}
