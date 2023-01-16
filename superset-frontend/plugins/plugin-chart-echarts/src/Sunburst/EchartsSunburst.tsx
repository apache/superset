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
import React, { useCallback } from 'react';
import { BinaryQueryObjectFilterClause } from '@superset-ui/core';
import { SunburstTransformedProps } from './types';
import Echart from '../components/Echart';
import { EventHandlers, TreePathInfo } from '../types';

export const extractTreePathInfo = (treePathInfo: TreePathInfo[] | undefined) =>
  (treePathInfo ?? [])
    .map(pathInfo => pathInfo?.name || '')
    .filter(path => path !== '');

export default function EchartsSunburst(props: SunburstTransformedProps) {
  const {
    height,
    width,
    echartOptions,
    setDataMask,
    labelMap,
    groupby,
    selectedValues,
    formData,
    onContextMenu,
    refs,
  } = props;

  const { emitFilter } = formData;

  const handleChange = useCallback(
    (values: string[]) => {
      if (!emitFilter) {
        return;
      }

      const groupbyValues = values.map(value => labelMap[value]);

      setDataMask({
        extraFormData: {
          filters:
            values.length === 0
              ? []
              : groupby.map((col, idx) => {
                  const val = groupbyValues.map(v => v[idx]);
                  if (val === null || val === undefined)
                    return {
                      col,
                      op: 'IS NULL',
                    };
                  return {
                    col,
                    op: 'IN',
                    val: val as (string | number | boolean)[],
                  };
                }),
        },
        filterState: {
          value: groupbyValues.length ? groupbyValues : null,
          selectedValues: values.length ? values : null,
        },
      });
    },
    [emitFilter, setDataMask, groupby, labelMap],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { treePathInfo } = props;
      const treePath = extractTreePathInfo(treePathInfo);
      const name = treePath.join(',');
      const values = Object.values(selectedValues);
      if (values.includes(name)) {
        handleChange(values.filter(v => v !== name));
      } else {
        handleChange([name]);
      }
    },
    contextmenu: eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const treePath = extractTreePathInfo(eventParams.treePathInfo);
        if (treePath.length > 0) {
          const pointerEvent = eventParams.event.event;
          const filters: BinaryQueryObjectFilterClause[] = [];
          treePath.forEach((path, i) =>
            filters.push({
              col: groupby[i],
              op: '==',
              val: path,
              formattedVal: path,
            }),
          );
          onContextMenu(pointerEvent.clientX, pointerEvent.clientY, filters);
        }
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
      selectedValues={selectedValues}
    />
  );
}
