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
import React, { useCallback, useRef } from 'react';
import { ViewRootGroup } from 'echarts/types/src/util/types';
import GlobalModel from 'echarts/types/src/model/Global';
import ComponentModel from 'echarts/types/src/model/Component';
import { EchartsHandler, EventHandlers } from '../types';
import Echart from '../components/Echart';
import { TimeseriesChartTransformedProps } from './types';
import { currentSeries } from '../utils/series';

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
  legendData = [],
}: TimeseriesChartTransformedProps) {
  const { emitFilter, stack } = formData;
  const echartRef = useRef<EchartsHandler | null>(null);
  const lastTimeRef = useRef(Date.now());
  const lastSelectedLegend = useRef('');
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();

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
          label: groupbyValues.length ? groupbyValues : undefined,
          value: groupbyValues.length ? groupbyValues : null,
          selectedValues: values.length ? values : null,
        },
      });
    },
    [groupby, labelMap, setDataMask],
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
    <Echart
      ref={echartRef}
      height={height}
      width={width}
      echartOptions={echartOptions}
      eventHandlers={eventHandlers}
      zrEventHandlers={zrEventHandlers}
      selectedValues={selectedValues}
    />
  );
}
