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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DTTM_ALIAS,
  BinaryQueryObjectFilterClause,
  AxisType,
} from '@superset-ui/core';
import { ViewRootGroup } from 'echarts/types/src/util/types';
import GlobalModel from 'echarts/types/src/model/Global';
import ComponentModel from 'echarts/types/src/model/Component';
import { EchartsHandler, EventHandlers } from '../types';
import Echart from '../components/Echart';
import { TimeseriesChartTransformedProps } from './types';
import { currentSeries } from '../utils/series';
import { ExtraControls } from '../components/ExtraControls';

const TIMER_DURATION = 300;

// @ts-ignore
export default function EchartsTimeseries({
  formData,
  height,
  width,
  echartOptions,
  groupby,
  labelMap,
  selectedValues,
  setDataMask,
  setControlValue,
  legendData = [],
  onContextMenu,
  xValueFormatter,
  xAxis,
  refs,
  emitCrossFilters,
}: TimeseriesChartTransformedProps) {
  const { stack } = formData;
  const echartRef = useRef<EchartsHandler | null>(null);
  // eslint-disable-next-line no-param-reassign
  refs.echartRef = echartRef;
  const lastTimeRef = useRef(Date.now());
  const lastSelectedLegend = useRef('');
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const extraControlRef = useRef<HTMLDivElement>(null);
  const [extraControlHeight, setExtraControlHeight] = useState(0);
  useEffect(() => {
    const updatedHeight = extraControlRef.current?.offsetHeight || 0;
    setExtraControlHeight(updatedHeight);
  }, [formData.showExtraControls]);

  const handleDoubleClickChange = useCallback(
    (name?: string) => {
      const echartInstance = echartRef.current?.getEchartInstance();
      if (!name) {
        currentSeries.legend = '';
        echartInstance?.dispatchAction({
          type: 'legendAllSelect',
        });
      } else {
        legendData.forEach(datum => {
          if (datum === name) {
            currentSeries.legend = datum;
            echartInstance?.dispatchAction({
              type: 'legendSelect',
              name: datum,
            });
          } else {
            echartInstance?.dispatchAction({
              type: 'legendUnSelect',
              name: datum,
            });
          }
        });
      }
    },
    [legendData],
  );

  const getModelInfo = (target: ViewRootGroup, globalModel: GlobalModel) => {
    let el = target;
    let model: ComponentModel | null = null;
    while (el) {
      // eslint-disable-next-line no-underscore-dangle
      const modelInfo = el.__ecComponentInfo;
      if (modelInfo != null) {
        model = globalModel.getComponent(modelInfo.mainType, modelInfo.index);
        break;
      }
      el = el.parent;
    }
    return model;
  };

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
          label: groupbyValues.length ? groupbyValues : undefined,
          value: groupbyValues.length ? groupbyValues : null,
          selectedValues: values.length ? values : null,
        },
      });
    },
    [groupby, labelMap, setDataMask, emitCrossFilters],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      // Ensure that double-click events do not trigger single click event. So we put it in the timer.
      clickTimer.current = setTimeout(() => {
        const { seriesName: name } = props;
        const values = Object.values(selectedValues);
        if (values.includes(name)) {
          handleChange(values.filter(v => v !== name));
        } else {
          handleChange([name]);
        }
      }, TIMER_DURATION);
    },
    mouseout: () => {
      currentSeries.name = '';
    },
    mouseover: params => {
      currentSeries.name = params.seriesName;
    },
    legendselectchanged: payload => {
      const currentTime = Date.now();
      // TIMER_DURATION is the interval between two legendselectchanged event
      if (
        currentTime - lastTimeRef.current < TIMER_DURATION &&
        lastSelectedLegend.current === payload.name
      ) {
        // execute dbclick
        handleDoubleClickChange(payload.name);
      } else {
        lastTimeRef.current = currentTime;
        // remember last selected legend
        lastSelectedLegend.current = payload.name;
      }
      // if all legend is unselected, we keep all selected
      if (Object.values(payload.selected).every(i => !i)) {
        handleDoubleClickChange();
      }
    },
    contextmenu: eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data } = eventParams;
        if (data) {
          const pointerEvent = eventParams.event.event;
          const values = [
            ...(eventParams.name ? [eventParams.name] : []),
            ...labelMap[eventParams.seriesName],
          ];
          const filters: BinaryQueryObjectFilterClause[] = [];
          if (xAxis.type === AxisType.time) {
            filters.push({
              col:
                // if the xAxis is '__timestamp', granularity_sqla will be the column of filter
                xAxis.label === DTTM_ALIAS
                  ? formData.granularitySqla
                  : xAxis.label,
              grain: formData.timeGrainSqla,
              op: '==',
              val: data[0],
              formattedVal: xValueFormatter(data[0]),
            });
          }
          [
            ...(xAxis.type === AxisType.category ? [xAxis.label] : []),
            ...formData.groupby,
          ].forEach((dimension, i) =>
            filters.push({
              col: dimension,
              op: '==',
              val: values[i],
              formattedVal: String(values[i]),
            }),
          );
          onContextMenu(pointerEvent.clientX, pointerEvent.clientY, filters);
        }
      }
    },
  };

  const zrEventHandlers: EventHandlers = {
    dblclick: params => {
      // clear single click timer
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      const pointInPixel = [params.offsetX, params.offsetY];
      const echartInstance = echartRef.current?.getEchartInstance();
      if (echartInstance?.containPixel('grid', pointInPixel)) {
        // do not trigger if click unstacked chart's blank area
        if (!stack && params.target?.type === 'ec-polygon') return;
        // @ts-ignore
        const globalModel = echartInstance.getModel();
        const model = getModelInfo(params.target, globalModel);
        const seriesCount = globalModel.getSeriesCount();
        const currentSeriesIndices = globalModel.getCurrentSeriesIndices();
        if (model) {
          const { name } = model;
          if (seriesCount !== currentSeriesIndices.length) {
            handleDoubleClickChange();
          } else {
            handleDoubleClickChange(name);
          }
        }
      }
    },
  };

  return (
    <>
      <div ref={extraControlRef}>
        <ExtraControls formData={formData} setControlValue={setControlValue} />
      </div>
      <Echart
        refs={refs}
        height={height - extraControlHeight}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
        zrEventHandlers={zrEventHandlers}
        selectedValues={selectedValues}
      />
    </>
  );
}
