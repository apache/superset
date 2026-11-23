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
import { DataRecordValue } from '@superset-ui/core';
import { HeatmapTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import {
  getHeatmapCrossFilterDataMask,
  getSelectedHeatmapKeys,
} from './crossFilter';

type HeatmapCellDatum = {
  xValue: DataRecordValue;
  yValue: DataRecordValue;
  value: (number | string | null | undefined)[];
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
  } = props;

  const eventHandlers: EventHandlers = useMemo(() => {
    const selectedKeys = getSelectedHeatmapKeys(filterState?.selectedValues);

    return {
      click: (event: { data?: unknown }) => {
        if (
          !emitCrossFilters ||
          !setDataMask ||
          !isHeatmapCellDatum(event.data)
        ) {
          return;
        }
        const { xValue, yValue } = event.data;
        const crossFilter = getHeatmapCrossFilterDataMask({
          xColumn: formData.xAxis,
          yColumn: formData.groupby,
          xValue,
          yValue,
          selectedKeys,
          coltypeMapping,
        });
        setDataMask(crossFilter.dataMask);
      },
    };
  }, [
    coltypeMapping,
    emitCrossFilters,
    filterState?.selectedValues,
    formData.groupby,
    formData.xAxis,
    setDataMask,
  ]);

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
