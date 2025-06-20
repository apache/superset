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
import Echart from '../components/Echart';
import { WaterfallChartTransformedProps } from './types';
import { EventHandlers } from '../types';

export default function EchartsWaterfall(
  props: WaterfallChartTransformedProps,
) {
  const {
    height,
    width,
    echartOptions,
    setDataMask,
    onContextMenu,
    refs,
    onLegendStateChanged,
    emitCrossFilters,
    filterState,
    handleCrossFilter,
  } = props;

  const eventHandlers: EventHandlers = {
    click: params => {
      if (!setDataMask || !emitCrossFilters) return;

      const { name: value } = params;
      if (value === 'Total') return;
      const filterOptions = handleCrossFilter(
        value,
        filterState?.value === value,
      );
      if (!filterOptions) return;

      setDataMask(filterOptions);
    },
    contextmenu: params => {
      if (onContextMenu) {
        onContextMenu(params.name, 0);
      }
    },
    legendselectchanged: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendselectall: payload => {
      onLegendStateChanged?.(payload.selected);
    },
    legendinverseselect: payload => {
      onLegendStateChanged?.(payload.selected);
    },
  };

  return (
    <Echart
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      refs={refs}
    />
  );
}
