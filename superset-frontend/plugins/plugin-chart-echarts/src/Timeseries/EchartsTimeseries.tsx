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
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DTTM_ALIAS,
  BinaryQueryObjectFilterClause,
  AxisType,
  getTimeFormatter,
  getColumnLabel,
  getNumberFormatter,
  LegendState,
  ensureIsArray,
} from '@superset-ui/core';
import type { ViewRootGroup } from 'echarts/types/src/util/types';
import type GlobalModel from 'echarts/types/src/model/Global';
import type ComponentModel from 'echarts/types/src/model/Component';
import { EchartsHandler, EventHandlers } from '../types';
import Echart from '../components/Echart';
import { TimeseriesChartTransformedProps } from './types';
import { formatSeriesName } from '../utils/series';
import { ExtraControls } from '../components/ExtraControls';

const TIMER_DURATION = 300;

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
  onLegendStateChanged,
  onFocusedSeries,
  xValueFormatter,
  xAxis,
  refs,
  emitCrossFilters,
  coltypeMapping,
  onLegendScroll,
}: TimeseriesChartTransformedProps) {
  const { stack } = formData;
  const echartRef = useRef<EchartsHandler | null>(null);
  // eslint-disable-next-line no-param-reassign
  refs.echartRef = echartRef;
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  // Track if we just applied a brush filter to prevent immediate reset on re-render
  const brushFilterApplied = useRef(false);
  const extraControlRef = useRef<HTMLDivElement>(null);
  const [extraControlHeight, setExtraControlHeight] = useState(0);
  useEffect(() => {
    const element = extraControlRef.current;
    if (!element) {
      setExtraControlHeight(0);
      return;
    }

    const updateHeight = () => {
      setExtraControlHeight(element.offsetHeight || 0);
    };

    updateHeight();

    if (typeof ResizeObserver === 'function') {
      const resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(element);
      return () => {
        resizeObserver.disconnect();
      };
    }

    window.addEventListener('resize', updateHeight);
    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, [formData.showExtraControls]);

  // Activate brush mode for time-axis charts
  useEffect(() => {
    if (xAxis.type !== AxisType.Time) {
      return;
    }

    // Skip on touch devices to avoid interfering with scrolling
    if (
      typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0))
    ) {
      return;
    }

    // Small delay to ensure chart is fully rendered
    const timer = setTimeout(() => {
      const echartInstance = echartRef.current?.getEchartInstance();
      if (echartInstance) {
        echartInstance.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'brush',
          brushOption: {
            brushType: 'rect',
            brushMode: 'single',
          },
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [xAxis.type]);

  const hasDimensions = ensureIsArray(groupby).length > 0;

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

  const getCrossFilterDataMask = useCallback(
    (value: string) => {
      const selected: string[] = Object.values(selectedValues);
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
            label: groupbyValues.length ? groupbyValues : undefined,
            value: groupbyValues.length ? groupbyValues : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(value),
      };
    },
    [groupby, labelMap, selectedValues],
  );

  const handleChange = useCallback(
    (value: string) => {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(value).dataMask);
    },
    [emitCrossFilters, setDataMask, getCrossFilterDataMask],
  );

  const handleBrushEnd = useCallback(
    (params: any) => {
      if (xAxis.type !== AxisType.Time) {
        return;
      }

      // Skip on touch devices to avoid interfering with scrolling
      const isTouchDevice =
        typeof window !== 'undefined' &&
        ('ontouchstart' in window ||
          (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));
      if (isTouchDevice) {
        return;
      }

      const brushAreas = params.areas || [];

      if (brushAreas.length === 0) {
        // If we just applied a filter, the chart re-rendered and cleared the brush
        // Don't reset the filter in this case
        if (brushFilterApplied.current) {
          brushFilterApplied.current = false;
          return;
        }
        // Brush was cleared by user, reset the filter
        setTimeout(() => {
          if (emitCrossFilters) {
            setDataMask({
              extraFormData: {},
              filterState: {
                value: null,
                selectedValues: null,
              },
            });
          }
        }, 0);
        return;
      }

      const area = brushAreas[0];
      const coordRange = area.coordRange;

      // Debug: log the brush area structure
      // eslint-disable-next-line no-console
      console.log('[BRUSH DEBUG] area:', JSON.stringify(area));

      // For lineX brush, coordRange is [xMin, xMax] (flat array)
      if (!coordRange || coordRange.length < 2) {
        return;
      }

      const [startValue, endValue] = coordRange.map(Number);

      // Debug: log the extracted values
      // eslint-disable-next-line no-console
      console.log('[BRUSH DEBUG] startValue:', startValue, 'endValue:', endValue);

      // Validate that we have valid timestamps
      if (
        !Number.isFinite(startValue) ||
        !Number.isFinite(endValue) ||
        startValue <= 0 ||
        endValue <= 0
      ) {
        return;
      }

      // Convert timestamps to ISO date strings for time_range format
      const startDate = new Date(startValue).toISOString().slice(0, 19);
      const endDate = new Date(endValue).toISOString().slice(0, 19);
      const timeRange = `${startDate} : ${endDate}`;

      // Mark that we're applying a filter so we don't reset on re-render
      brushFilterApplied.current = true;

      // Defer to let brush event complete before triggering re-render
      setTimeout(() => {
        // In Explore view, update the time_range control
        if (setControlValue) {
          setControlValue('time_range', timeRange);
        }
        // On dashboards, emit cross-filter
        if (emitCrossFilters) {
          const col =
            xAxis.label === DTTM_ALIAS ? formData.granularitySqla : xAxis.label;
          const startFormatted = xValueFormatter(startValue);
          const endFormatted = xValueFormatter(endValue);
          setDataMask({
            extraFormData: {
              filters: [
                { col, op: '>=', val: startValue },
                { col, op: '<=', val: endValue },
              ],
            },
            filterState: {
              value: [startValue, endValue],
              selectedValues: [startValue, endValue],
              label: `${startFormatted} - ${endFormatted}`,
            },
          });
        }
      }, 0);
    },
    [emitCrossFilters, formData, setControlValue, setDataMask, xAxis, xValueFormatter],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      if (!hasDimensions) {
        return;
      }
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      // Ensure that double-click events do not trigger single click event. So we put it in the timer.
      clickTimer.current = setTimeout(() => {
        const { seriesName: name } = props;
        handleChange(name);
      }, TIMER_DURATION);
    },
    mouseout: () => {
      onFocusedSeries(null);
    },
    mouseover: params => {
      onFocusedSeries(params.seriesName);
    },
    legendscroll: payload => {
      onLegendScroll?.(payload.scrollDataIndex);
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
    contextmenu: async eventParams => {
      if (onContextMenu) {
        eventParams.event.stop();
        const { data, seriesName } = eventParams;
        const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
        const drillByFilters: BinaryQueryObjectFilterClause[] = [];
        const pointerEvent = eventParams.event.event;
        const values = [
          ...(eventParams.name ? [eventParams.name] : []),
          ...(labelMap[seriesName] ?? []),
        ];
        const groupBy = ensureIsArray(formData.groupby);
        if (data && xAxis.type === AxisType.Time) {
          drillToDetailFilters.push({
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
          ...(xAxis.type === AxisType.Category && data ? [xAxis.label] : []),
          ...groupBy,
        ].forEach((dimension, i) =>
          drillToDetailFilters.push({
            col: dimension,
            op: '==',
            val: values[i],
            formattedVal: String(values[i]),
          }),
        );
        groupBy.forEach((dimension, i) => {
          const dimensionValues = labelMap[seriesName] ?? [];

          // Skip the metric values at the beginning and get the actual dimension value
          // If we have multiple metrics, they come first, then the dimension values
          const metricsCount = dimensionValues.length - groupBy.length;
          const val = dimensionValues[metricsCount + i];

          drillByFilters.push({
            col: dimension,
            op: '==',
            val,
            formattedVal: formatSeriesName(val, {
              timeFormatter: getTimeFormatter(formData.dateFormat),
              numberFormatter: getNumberFormatter(formData.numberFormat),
              coltype: coltypeMapping?.[getColumnLabel(dimension)],
            }),
          });
        });

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          drillBy: { filters: drillByFilters, groupbyFieldName: 'groupby' },
          crossFilter: hasDimensions
            ? getCrossFilterDataMask(seriesName)
            : undefined,
        });
      }
    },
    brushEnd: handleBrushEnd,
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
        if (model) {
          const { name } = model;
          const legendState: LegendState = legendData.reduce(
            (previous, datum) => ({
              ...previous,
              [datum]: datum === name,
            }),
            {},
          );
          onLegendStateChanged?.(legendState);
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
        ref={echartRef}
        refs={refs}
        height={height - extraControlHeight}
        width={width}
        echartOptions={echartOptions}
        eventHandlers={eventHandlers}
        zrEventHandlers={zrEventHandlers}
        selectedValues={selectedValues}
        vizType={formData.vizType}
      />
    </>
  );
}
