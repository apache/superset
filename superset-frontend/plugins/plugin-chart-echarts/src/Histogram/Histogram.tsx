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
import { ContextMenuFilters, QueryFormColumn } from '@superset-ui/core';
import { HistogramTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import { useLegendEventHandlers } from '../utils/legendEventHandlers';
import {
  getHistogramCrossFilterDataMask,
  getHistogramDrillFilters,
  getSelectedHistogramKeys,
} from './crossFilter';

const noop = () => {};

type HistogramBarEvent = {
  seriesIndex?: number;
  dataIndex?: number;
  event?: { stop: () => void; event: PointerEvent };
};

export default function Histogram(props: HistogramTransformedProps) {
  const {
    bins,
    coltypeMapping,
    echartOptions,
    emitCrossFilters,
    filterState,
    formData,
    height,
    onContextMenu,
    onFocusedSeries,
    onLegendScroll,
    onLegendStateChanged,
    refs,
    seriesGroupby,
    setDataMask = noop,
    width,
  } = props;
  const { column, groupby = [] } = formData;
  const groupbyColumns = groupby as QueryFormColumn[];

  const legendEventHandlers = useLegendEventHandlers(
    onLegendStateChanged,
    onLegendScroll,
  );

  const crossFilterHandlers: EventHandlers = useMemo(() => {
    const selectedKeys = getSelectedHistogramKeys(filterState?.selectedValues);
    const maskFor = (event: HistogramBarEvent) => {
      const { seriesIndex, dataIndex } = event;
      if (seriesIndex == null || dataIndex == null) {
        return undefined;
      }
      const bin = bins[dataIndex];
      const groupbyValues = seriesGroupby[seriesIndex];
      if (!bin || !groupbyValues) {
        return undefined;
      }
      return {
        bin,
        groupbyValues,
        mask: getHistogramCrossFilterDataMask({
          column,
          groupby: groupbyColumns,
          bin,
          groupbyValues,
          selectedKeys,
          coltypeMapping,
        }),
      };
    };

    return {
      click: (event: HistogramBarEvent) => {
        if (!emitCrossFilters) {
          return;
        }
        const match = maskFor(event);
        if (!match) {
          return;
        }
        setDataMask(match.mask.dataMask);
      },
      contextmenu: (event: HistogramBarEvent) => {
        if (!onContextMenu) {
          return;
        }
        const match = maskFor(event);
        if (!match) {
          return;
        }
        event.event?.stop();
        const pointerEvent = event.event?.event;
        if (!pointerEvent) {
          return;
        }
        // IS NULL is unary. The menu types only binary operators, and both
        // drill paths forward `op` unchanged.
        const drillFilters = getHistogramDrillFilters({
          column,
          groupby: groupbyColumns,
          bin: match.bin,
          groupbyValues: match.groupbyValues,
          coltypeMapping,
        }) as NonNullable<ContextMenuFilters['drillToDetail']>;
        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillFilters,
          crossFilter: match.mask,
          drillBy: {
            filters: drillFilters,
            groupbyFieldName: 'groupby',
          },
        });
      },
    };
  }, [
    bins,
    coltypeMapping,
    column,
    emitCrossFilters,
    filterState?.selectedValues,
    groupbyColumns,
    onContextMenu,
    seriesGroupby,
    setDataMask,
  ]);

  const eventHandlers: EventHandlers = {
    ...legendEventHandlers,
    ...crossFilterHandlers,
    mouseout: () => {
      onFocusedSeries(undefined);
    },
    mouseover: params => {
      onFocusedSeries(params.seriesIndex);
    },
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
