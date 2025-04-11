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
import {
  BinaryQueryObjectFilterClause,
  ContextMenuFilters,
  DataMask,
  QueryFormColumn,
  QueryFormData,
  getColumnLabel,
  getNumberFormatter,
  getTimeFormatter,
} from '@superset-ui/core';

import {
  BaseTransformedProps,
  CrossFilterTransformedProps,
  EventHandlers,
} from '../types';
import { formatSeriesName } from './series';

export type Event = {
  name: string;
  event: { stop: () => void; event: PointerEvent };
};

const getCrossFilterDataMask =
  (
    selectedValues: Record<number, string>,
    groupby: QueryFormColumn[],
    labelMap: Record<string, string[]>,
  ) =>
  (value: string) => {
    const selected = Object.values(selectedValues);
    let values: string[];
    if (selected.includes(value)) {
      values = selected.filter(v => v !== value);
    } else {
      values = [value];
    }

    const groupbyValues = values.map(value => labelMap[value]);

    return {
      dataMask: {
        extraFormData: {
          filters:
            values.length === 0
              ? []
              : groupby.map((col, idx) => {
                  const val = groupbyValues.map(v => v[idx]);
                  if (val === null || val === undefined)
                    return {
                      col,
                      op: 'IS NULL' as const,
                    };
                  return {
                    col,
                    op: 'IN' as const,
                    val: val as (string | number | boolean)[],
                  };
                }),
        },
        filterState: {
          value: groupbyValues.length ? groupbyValues : null,
          selectedValues: values.length ? values : null,
        },
      },
      isCurrentValueSelected: selected.includes(value),
    };
  };

export const clickEventHandler =
  (
    getCrossFilterDataMask: (
      value: string,
    ) => ContextMenuFilters['crossFilter'],
    setDataMask: (dataMask: DataMask) => void,
    emitCrossFilters?: boolean,
  ) =>
  ({ name }: { name: string }) => {
    if (!emitCrossFilters) {
      return;
    }
    const dataMask = getCrossFilterDataMask(name)?.dataMask;
    if (dataMask) {
      setDataMask(dataMask);
    }
  };

export const contextMenuEventHandler =
  (
    groupby: (BaseTransformedProps<any> &
      CrossFilterTransformedProps)['groupby'],
    onContextMenu: BaseTransformedProps<any>['onContextMenu'],
    labelMap: Record<string, string[]>,
    getCrossFilterDataMask: (
      value: string,
    ) => ContextMenuFilters['crossFilter'],
    formData: QueryFormData,
    coltypeMapping?: Record<string, number>,
  ) =>
  (e: Event) => {
    if (onContextMenu) {
      e.event.stop();
      const pointerEvent = e.event.event;
      const drillFilters: BinaryQueryObjectFilterClause[] = [];
      if (groupby.length > 0) {
        const values = labelMap[e.name];
        groupby.forEach((dimension, i) => {
          drillFilters.push({
            col: dimension,
            op: '==',
            val: values[i],
            formattedVal: formatSeriesName(values[i], {
              timeFormatter: getTimeFormatter(formData.dateFormat),
              numberFormatter: getNumberFormatter(formData.numberFormat),
              coltype: coltypeMapping?.[getColumnLabel(dimension)],
            }),
          });
        });
      }
      onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
        drillToDetail: drillFilters,
        crossFilter:
          groupby.length > 0 ? getCrossFilterDataMask(e.name) : undefined,
        drillBy: { filters: drillFilters, groupbyFieldName: 'groupby' },
      });
    }
  };

export const allEventHandlers = (
  transformedProps: BaseTransformedProps<any> & CrossFilterTransformedProps,
) => {
  const {
    groupby,
    onContextMenu,
    setDataMask,
    labelMap,
    emitCrossFilters,
    selectedValues,
    coltypeMapping,
    formData,
  } = transformedProps;
  const eventHandlers: EventHandlers = {
    click:
      groupby.length > 0
        ? clickEventHandler(
            getCrossFilterDataMask(selectedValues, groupby, labelMap),
            setDataMask,
            emitCrossFilters,
          )
        : () => {},
    contextmenu: contextMenuEventHandler(
      groupby,
      onContextMenu,
      labelMap,
      getCrossFilterDataMask(selectedValues, groupby, labelMap),
      formData,
      coltypeMapping,
    ),
  };
  return eventHandlers;
};
