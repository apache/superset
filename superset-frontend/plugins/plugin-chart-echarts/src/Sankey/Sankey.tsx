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
import { ContextMenuFilters } from '@superset-ui/core';
import { SankeyTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers } from '../types';
import {
  getSankeyCrossFilterDataMask,
  getSankeyDrillFilters,
  getSelectedSankeyKeys,
  isSankeyLinkDatum,
  isSankeyNodeDatum,
  SankeyLinkDatum,
  SankeyNodeDatum,
} from './crossFilter';

const noop = () => {};

type SankeyEvent = {
  data?: unknown;
  event?: { stop: () => void; event: PointerEvent };
};

function isSankeyDatum(
  data: unknown,
): data is SankeyNodeDatum | SankeyLinkDatum {
  return isSankeyNodeDatum(data) || isSankeyLinkDatum(data);
}

export default function Sankey(props: SankeyTransformedProps) {
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
  } = props;
  const { source, target } = formData;

  const eventHandlers: EventHandlers = useMemo(() => {
    const selectedKeys = getSelectedSankeyKeys(filterState?.selectedValues);
    const crossFilterFor = (datum: SankeyNodeDatum | SankeyLinkDatum) =>
      getSankeyCrossFilterDataMask({
        source,
        target,
        datum,
        selectedKeys,
        coltypeMapping,
      });

    return {
      click: (event: SankeyEvent) => {
        if (!emitCrossFilters || !isSankeyDatum(event.data)) {
          return;
        }
        setDataMask(crossFilterFor(event.data).dataMask);
      },
      contextmenu: (event: SankeyEvent) => {
        if (!onContextMenu || !isSankeyDatum(event.data)) {
          return;
        }
        event.event?.stop();
        const pointerEvent = event.event?.event;
        if (!pointerEvent) {
          return;
        }
        const { data } = event;
        // The context menu types only binary operators. IS NULL is unary, and
        // both drill paths forward `op` to the query unchanged.
        const drillFilters = getSankeyDrillFilters(
          source,
          target,
          data,
          coltypeMapping,
        ) as NonNullable<ContextMenuFilters['drillToDetail']>;
        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillFilters,
          crossFilter: crossFilterFor(data),
          ...(isSankeyNodeDatum(data) && {
            drillBy: {
              filters: drillFilters,
              groupbyFieldName: data.filterColumn,
            },
          }),
        });
      },
    };
  }, [
    coltypeMapping,
    emitCrossFilters,
    filterState?.selectedValues,
    onContextMenu,
    setDataMask,
    source,
    target,
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
