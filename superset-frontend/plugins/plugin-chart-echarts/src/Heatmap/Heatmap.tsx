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
  TimeGranularity,
  getXAxisColumn,
} from '@superset-ui/core';
import { HeatmapTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import {
  getHeatmapCrossFilterDataMask,
  getHeatmapDrillByFilters,
  getHeatmapDrillFilters,
  getSelectedHeatmapKeys,
} from './crossFilter';

type HeatmapCellDatum = {
  xValue: DataRecordValue;
  yValue: DataRecordValue;
  value: (number | string | null | undefined)[];
};

type HeatmapEvent = {
  data?: unknown;
  event?: { stop: () => void; event: PointerEvent };
};

function isHeatmapCellDatum(data: unknown): data is HeatmapCellDatum {
  return (
    typeof data === 'object' &&
    data !== null &&
    'xValue' in data &&
    'yValue' in data
  );
}

export default function Heatmap(props: HeatmapTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    refs,
    formData,
    emitCrossFilters,
    filterState,
    setDataMask,
    coltypeMapping,
    onContextMenu,
  } = props;

  const xAxisColumn =
    getXAxisColumn(formData) ?? (formData.xAxis as QueryFormColumn | undefined);
  const timeGrain = (formData.extraFormData?.time_grain_sqla ??
    formData.time_grain_sqla ??
    formData.timeGrainSqla) as TimeGranularity | undefined;
  const granularitySqla = (formData.extraFormData?.granularity_sqla ??
    formData.granularity_sqla ??
    formData.granularitySqla) as string | undefined;

  const eventHandlers: EventHandlers = useMemo(() => {
    const selectedKeys = getSelectedHeatmapKeys(filterState?.selectedValues);

    return {
      click: (event: HeatmapEvent) => {
        if (
          !emitCrossFilters ||
          !setDataMask ||
          !isHeatmapCellDatum(event.data)
        ) {
          return;
        }
        const { xValue, yValue } = event.data;
        const crossFilter = getHeatmapCrossFilterDataMask({
          xColumn: xAxisColumn,
          yColumn: formData.groupby,
          xValue,
          yValue,
          selectedKeys,
          coltypeMapping,
          timeGrain,
          granularitySqla,
        });
        setDataMask(crossFilter.dataMask);
      },
      contextmenu: (event: HeatmapEvent) => {
        if (!onContextMenu || !isHeatmapCellDatum(event.data)) {
          return;
        }
        event.event?.stop();
        const pointerEvent = event.event?.event;
        if (!pointerEvent) {
          return;
        }
        const { xValue, yValue } = event.data;
        const drillFilters = getHeatmapDrillFilters({
          xColumn: xAxisColumn,
          yColumn: formData.groupby,
          xValue,
          yValue,
          coltypeMapping,
          timeGrain,
          granularitySqla,
        }) as NonNullable<ContextMenuFilters['drillToDetail']>;

        const drillBy = getHeatmapDrillByFilters({
          xColumn: xAxisColumn,
          yColumn: formData.groupby,
          xValue,
          yValue,
          coltypeMapping,
          timeGrain,
          granularitySqla,
        }) as ContextMenuFilters['drillBy'];

        const crossFilter =
          emitCrossFilters && setDataMask
            ? getHeatmapCrossFilterDataMask({
                xColumn: xAxisColumn,
                yColumn: formData.groupby,
                xValue,
                yValue,
                selectedKeys,
                coltypeMapping,
                timeGrain,
                granularitySqla,
              })
            : undefined;

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillFilters,
          drillBy,
          ...(crossFilter && { crossFilter }),
        });
      },
    };
  }, [
    coltypeMapping,
    emitCrossFilters,
    filterState?.selectedValues,
    formData.groupby,
    granularitySqla,
    onContextMenu,
    setDataMask,
    timeGrain,
    xAxisColumn,
  ]);

  return (
    <Echart
      refs={refs}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      vizType={formData.vizType ?? formData.viz_type}
    />
  );
}
