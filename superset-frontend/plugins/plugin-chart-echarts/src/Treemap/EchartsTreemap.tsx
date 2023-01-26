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
  DataRecordValue,
  BinaryQueryObjectFilterClause,
} from '@superset-ui/core';
import React, { useCallback } from 'react';
import Echart from '../components/Echart';
import { NULL_STRING } from '../constants';
import { EventHandlers } from '../types';
import { extractTreePathInfo } from './constants';
import { TreemapTransformedProps } from './types';

export default function EchartsTreemap({
  echartOptions,
  emitCrossFilters,
  groupby,
  height,
  labelMap,
  onContextMenu,
  refs,
  setDataMask,
  selectedValues,
  width,
}: TreemapTransformedProps) {
  const handleChange = useCallback(
    (values: string[]) => {
      if (!emitCrossFilters) {
        return;
      }

      const groupbyValues = values.map(value => labelMap[value]);

      setDataMask({
        extraFormData: {
          filters:
            values.length === 0
              ? []
              : groupby.map((col, idx) => {
                  const val: DataRecordValue[] = groupbyValues.map(v => v[idx]);
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
    [groupby, labelMap, setDataMask, selectedValues],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      const { data, treePathInfo } = props;
      // do nothing when clicking on the parent node
      if (data?.children) {
        return;
      }
      const { treePath } = extractTreePathInfo(treePathInfo);
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
        const { treePath } = extractTreePathInfo(eventParams.treePathInfo);
        if (treePath.length > 0) {
          const pointerEvent = eventParams.event.event;
          const filters: BinaryQueryObjectFilterClause[] = [];
          treePath.forEach((path, i) =>
            filters.push({
              col: groupby[i],
              op: '==',
              val: path === 'null' ? NULL_STRING : path,
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
