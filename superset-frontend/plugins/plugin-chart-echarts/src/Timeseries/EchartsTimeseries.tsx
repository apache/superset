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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DTTM_ALIAS,
  BinaryQueryObjectFilterClause,
  AxisType,
  type TimeGranularity,
  getTimeFormatter,
  getColumnLabel,
  getNumberFormatter,
  LegendState,
  WithLegend,
  ensureIsArray,
  createTimeRangeFromGranularity,
} from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';
import { GenericDataType } from '@apache-superset/core/common';
import { logging } from '@apache-superset/core/utils';
import type {
  ECElementEvent,
  ViewRootGroup,
} from 'echarts/types/src/util/types';
import type GlobalModel from 'echarts/types/src/model/Global';
import type ComponentModel from 'echarts/types/src/model/Component';
import { EchartsHandler, EventHandlers } from '../types';
import Echart from '../components/Echart';
import {
  getViableTimeseriesEchartOptions,
  resolveTimeseriesGridOffset,
} from './transformers';
import {
  rebaseSeriesData,
  snapToNearestX,
  SeriesDataPoint,
} from './percentChange';
import {
  OrientationType,
  TimeseriesChartTransformedProps,
  TimeseriesCustomLegend,
} from './types';
import { formatSeriesName } from '../utils/series';
import { getTemporalXAxisDrillByFilter } from '../utils/xAxisDrillByFilter';
import { ExtraControls } from '../components/ExtraControls';
import TimeseriesLegend from './TimeseriesLegend';
import { TIMESERIES_CONSTANTS } from '../constants';

const TIMER_DURATION = 300;
const MAX_CUSTOM_LEGEND_HEIGHT = 160;
const MAX_CUSTOM_LEGEND_HEIGHT_RATIO = 0.3;
const MIN_TIMESERIES_PLOT_HEIGHT = 80;

// Bound the legend after accounting for the fixed ECharts grid reservations,
// leaving enough coordinate space for the plot itself to remain usable.
export const getTimeseriesLegendMaxHeight = (
  chartBodyHeight: number,
  grid: TimeseriesCustomLegend['grid'],
) =>
  Math.min(
    MAX_CUSTOM_LEGEND_HEIGHT,
    Math.floor(Math.max(chartBodyHeight, 0) * MAX_CUSTOM_LEGEND_HEIGHT_RATIO),
    Math.max(
      Math.floor(
        chartBodyHeight -
          resolveTimeseriesGridOffset(grid.top, chartBodyHeight) -
          resolveTimeseriesGridOffset(grid.bottom, chartBodyHeight) -
          MIN_TIMESERIES_PLOT_HEIGHT,
      ),
      0,
    ),
  );
const getTimestampFromTimeAxisValue = (value: string | number) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    logging.warn('Unable to parse time axis value for cross-filtering', value);
  }
  return Number.isNaN(timestamp) ? undefined : timestamp;
};

// Day, month, and year ranges end at 23:59:59.999, so adding 1ms lands on a
// whole-second next bucket boundary. The formatter intentionally emits seconds.
const formatDateTime = (date: Date) =>
  `${[
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')}T${[
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ].join(':')}`;

// Percent-change draggable baseline handle geometry, in pixels.
const BASELINE_HANDLE_WIDTH = 8;
const BASELINE_HANDLE_HALF_WIDTH = BASELINE_HANDLE_WIDTH / 2;
const BASELINE_HANDLE_STRIPE_X = 3;
const BASELINE_HANDLE_STRIPE_WIDTH = 2;

export default function EchartsTimeseries({
  formData,
  height,
  customLegend,
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
  resolvedTimeGrain,
  refs,
  emitCrossFilters,
  coltypeMapping,
  onLegendScroll,
}: TimeseriesChartTransformedProps) {
  const { stack } = formData;
  const theme = useTheme();
  const echartRef = useRef<EchartsHandler | null>(null);
  // eslint-disable-next-line no-param-reassign
  refs.echartRef = echartRef;
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();

  // Draggable percent-change baseline: when the rebase view is active, a
  // vertical line is drawn on the plot; dragging it re-indexes every series
  // to the hovered point via the composable rebase, entirely client-side.
  const rebaseEnabled = Boolean(
    (formData as { rebasePercentChange?: boolean }).rebasePercentChange,
  );
  // Persists the dragged baseline across effect reruns (e.g. resizes or
  // other option changes) so those don't silently snap it back to the
  // first point.
  const baselineXRef = useRef<number | string | null>(null);
  useEffect(() => {
    if (!rebaseEnabled) return undefined;
    const chart = echartRef.current?.getEchartInstance?.();
    if (!chart) return undefined;

    // Read series data from the echartOptions prop (the source of truth
    // this effect already depends on) rather than chart.getOption(), which
    // reflects the live instance's internal state and can still be empty
    // for a tick after mount or a warm navigation -- reading the prop
    // removes that race entirely instead of retrying past it.
    const { series } = echartOptions as { series?: { data?: unknown[] }[] };
    const baseSeries = (series ?? []).map(s =>
      Array.isArray(s.data)
        ? (s.data.filter(Array.isArray) as SeriesDataPoint[])
        : [],
    );
    // Preserve the axis' native x type: numeric for time/value axes,
    // string for category axes (coercing categories with Number() would
    // turn them into NaN and break snapping/positioning below).
    const xs = Array.from(new Set(baseSeries.flat().map(([x]) => x)));
    if (xs.length === 0) return undefined;
    if (typeof xs[0] === 'number') {
      (xs as number[]).sort((a, b) => a - b);
    }
    let baselineX =
      baselineXRef.current !== null && xs.includes(baselineXRef.current)
        ? baselineXRef.current
        : xs[0];
    baselineXRef.current = baselineX;
    // Coalesces drag updates to at most one setOption per animation
    // frame; rebasing every series on every raw pointer-move event
    // can stutter on large charts.
    let dragFrame: ReturnType<typeof requestAnimationFrame> | null = null;

    const applyBaseline = (newX: number | string) => {
      baselineX = newX;
      baselineXRef.current = newX;
      chart.setOption({
        series: baseSeries.map(data => ({
          data: rebaseSeriesData(data, newX),
        })),
      });
    };

    const drawHandle = () => {
      // Cap the handle to the plot area so it doesn't run through the
      // legend above or the axis labels below.
      let gridRect = { top: 0, height: chart.getHeight() };
      try {
        const rect = (
          chart as unknown as {
            getModel: () => {
              getComponent: (
                type: string,
                index: number,
              ) => {
                coordinateSystem: {
                  getRect: () => { y: number; height: number };
                };
              };
            };
          }
        )
          .getModel()
          .getComponent('grid', 0)
          .coordinateSystem.getRect();
        gridRect = { top: rect.y, height: rect.height };
      } catch {
        // fall back to the full chart height
      }
      let px: number;
      try {
        [px] = [chart.convertToPixel({ xAxisIndex: 0 }, baselineX) as number];
      } catch {
        return;
      }
      chart.setOption({
        graphic: [
          {
            id: 'percent-change-baseline',
            // only group elements support children in the graphic API
            type: 'group',
            x: px - BASELINE_HANDLE_HALF_WIDTH,
            y: gridRect.top,
            cursor: 'ew-resize',
            draggable: true,
            z: 100,
            ondrag(this: { x: number; y: number }) {
              this.y = gridRect.top;
              const dataX = chart.convertFromPixel(
                { xAxisIndex: 0 },
                this.x + BASELINE_HANDLE_HALF_WIDTH,
              ) as number | string;
              if (dragFrame !== null) return;
              dragFrame = requestAnimationFrame(() => {
                dragFrame = null;
                const snapped = snapToNearestX(xs, dataX);
                if (snapped !== undefined && snapped !== baselineX) {
                  applyBaseline(snapped);
                }
              });
            },
            ondragend: () => drawHandle(),
            children: [
              {
                type: 'rect',
                shape: {
                  x: 0,
                  y: 0,
                  width: BASELINE_HANDLE_WIDTH,
                  height: gridRect.height,
                },
                style: { fill: theme.colorFillSecondary },
              },
              {
                type: 'rect',
                shape: {
                  x: BASELINE_HANDLE_STRIPE_X,
                  y: 0,
                  width: BASELINE_HANDLE_STRIPE_WIDTH,
                  height: gridRect.height,
                },
                style: { fill: theme.colorTextSecondary },
              },
            ],
          },
        ],
      });
    };
    drawHandle();

    return () => {
      if (dragFrame !== null) {
        cancelAnimationFrame(dragFrame);
      }
      chart.setOption({
        graphic: [{ id: 'percent-change-baseline', $action: 'remove' }],
      });
    };
  }, [rebaseEnabled, echartOptions, width, height, theme]);
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
                    const val = groupbyValues.map(v => {
                      const metricsCount = v.length - groupby.length;
                      return v[metricsCount + idx];
                    });
                    if (val.every(vv => vv == null))
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

  // Cross-filter using X-axis value when no dimensions are set (issue #25334)
  const getXAxisCrossFilterDataMask = useCallback(
    (xAxisValue: string | number) => {
      const stringValue = String(xAxisValue);
      const selected: string[] = Object.values(selectedValues);
      let values: string[];
      if (selected.includes(stringValue)) {
        values = selected.filter(v => v !== stringValue);
      } else {
        values = [stringValue];
      }
      return {
        dataMask: {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : [
                    {
                      col: xAxis.label,
                      op: 'IN' as const,
                      val: values,
                    },
                  ],
          },
          filterState: {
            label: values.length ? values : undefined,
            value: values.length ? values : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected: selected.includes(stringValue),
      };
    },
    [selectedValues, xAxis.label],
  );

  const getTimeAxisCrossFilterDataMask = useCallback(
    (clickedTimestamp: number) => {
      const filterColumn =
        xAxis.label === DTTM_ALIAS ? formData.granularitySqla : xAxis.label;
      const grain = resolvedTimeGrain as TimeGranularity | undefined;

      if (!filterColumn || !grain) {
        return {
          dataMask: {
            extraFormData: {
              filters: [],
            },
            filterState: {
              label: undefined,
              value: null,
              selectedValues: null,
            },
          },
          isCurrentValueSelected: false,
        };
      }

      const [start, inclusiveEnd] = createTimeRangeFromGranularity(
        new Date(clickedTimestamp),
        grain,
        false,
      );
      const exclusiveEnd = new Date(inclusiveEnd.getTime() + 1);
      const timeRange = `${formatDateTime(start)} : ${formatDateTime(exclusiveEnd)}`;
      const selected: string[] = Object.values(selectedValues);
      const isCurrentValueSelected = selected.includes(timeRange);
      const values = isCurrentValueSelected ? [] : [timeRange];

      return {
        dataMask: {
          extraFormData: {
            filters:
              values.length === 0
                ? []
                : [
                    {
                      col: filterColumn,
                      op: 'TEMPORAL_RANGE' as const,
                      val: timeRange,
                    },
                  ],
          },
          filterState: {
            label: values.length ? values : undefined,
            value: values.length ? values : null,
            selectedValues: values.length ? values : null,
          },
        },
        isCurrentValueSelected,
      };
    },
    [formData.granularitySqla, resolvedTimeGrain, selectedValues, xAxis.label],
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

  // Handle cross-filter using X-axis value when no dimensions (issue #25334)
  const handleXAxisChange = useCallback(
    (xAxisValue: string | number) => {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getXAxisCrossFilterDataMask(xAxisValue).dataMask);
    },
    [emitCrossFilters, setDataMask, getXAxisCrossFilterDataMask],
  );

  const handleTimeAxisChange = useCallback(
    (clickedTimestamp: number) => {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getTimeAxisCrossFilterDataMask(clickedTimestamp).dataMask);
    },
    [emitCrossFilters, setDataMask, getTimeAxisCrossFilterDataMask],
  );

  // Determine if X-axis can be used for cross-filtering (categorical axis without dimensions)
  const canCrossFilterByXAxis =
    !hasDimensions &&
    (xAxis.type === AxisType.Category || xAxis.type === AxisType.Time);
  const xAxisValueIndex =
    formData.orientation === OrientationType.Horizontal ? 1 : 0;
  const getXAxisValue = useCallback(
    (data: unknown, name: unknown) => {
      if (Array.isArray(data)) {
        const categoryAxisValue = data[xAxisValueIndex];
        if (
          typeof categoryAxisValue === 'string' ||
          typeof categoryAxisValue === 'number'
        ) {
          return categoryAxisValue;
        }
      }
      if (typeof name === 'string' || typeof name === 'number') {
        return name;
      }
      return undefined;
    },
    [xAxisValueIndex],
  );

  const eventHandlers: EventHandlers = {
    click: props => {
      // Allow cross-filter by dimensions OR by categorical X-axis (issue #25334)
      if (!hasDimensions && !canCrossFilterByXAxis) {
        return;
      }
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      // Ensure that double-click events do not trigger single click event. So we put it in the timer.
      clickTimer.current = setTimeout(() => {
        if (hasDimensions) {
          // Cross-filter by dimension (original behavior)
          const { seriesName: name } = props;
          handleChange(name);
        } else if (
          canCrossFilterByXAxis &&
          xAxis.type === AxisType.Category &&
          props.componentType === 'series'
        ) {
          // Cross-filter by X-axis value when no dimensions (issue #25334)
          const categoryAxisValue = getXAxisValue(props.data, props.name);
          if (categoryAxisValue !== undefined) {
            handleXAxisChange(categoryAxisValue);
          }
        } else if (
          canCrossFilterByXAxis &&
          xAxis.type === AxisType.Time &&
          props.componentType === 'series'
        ) {
          const timeAxisValue = getXAxisValue(props.data, props.name);
          if (timeAxisValue !== undefined) {
            const timestamp = getTimestampFromTimeAxisValue(timeAxisValue);
            if (timestamp !== undefined) {
              handleTimeAxisChange(timestamp);
            }
          }
        }
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
          const timeAxisValue = getXAxisValue(data, eventParams.name);
          if (timeAxisValue !== undefined) {
            drillToDetailFilters.push({
              col:
                // if the xAxis is '__timestamp', granularity_sqla will be the column of filter
                xAxis.label === DTTM_ALIAS
                  ? formData.granularitySqla
                  : xAxis.label,
              grain: resolvedTimeGrain,
              op: '==',
              val: timeAxisValue,
              formattedVal: xValueFormatter(timeAxisValue),
            });
          }
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

        // Filters for the clicked x-axis value, so Drill By can subset the
        // drilled data to the clicked bar/point rather than only the series
        const xAxisFilters: BinaryQueryObjectFilterClause[] = [];
        const xAxisCol =
          // if the xAxis is '__timestamp', granularity_sqla will be the column of filter
          xAxis.label === DTTM_ALIAS ? formData.granularitySqla : xAxis.label;
        if (data && xAxis.type === AxisType.Time && xAxisCol) {
          // For horizontal orientation the [x, value] pair is swapped
          const xValue = Array.isArray(data) ? data[xAxisValueIndex] : data;
          const xAxisFilter = getTemporalXAxisDrillByFilter(
            xAxisCol,
            xValue,
            formData.timeGrainSqla,
            String(xValueFormatter(xValue as number)),
          );
          if (xAxisFilter) {
            xAxisFilters.push(xAxisFilter);
          }
        } else if (xAxis.type === AxisType.Category && xAxisCol) {
          const categoryAxisValue = getXAxisValue(data, eventParams.name);
          if (categoryAxisValue !== undefined) {
            // A category axis can still sit on a temporal column when the
            // axis is forced categorical; filter by time bucket in that case
            const xAxisFilter =
              coltypeMapping?.[getColumnLabel(xAxis.label)] ===
              GenericDataType.Temporal
                ? getTemporalXAxisDrillByFilter(
                    xAxisCol,
                    categoryAxisValue,
                    formData.timeGrainSqla,
                    String(eventParams.name ?? categoryAxisValue),
                  )
                : {
                    col: xAxisCol,
                    op: '==' as const,
                    val: categoryAxisValue,
                    formattedVal: String(categoryAxisValue),
                  };
            if (xAxisFilter) {
              xAxisFilters.push(xAxisFilter);
            }
          }
        }

        // Provide cross-filter for dimensions OR categorical X-axis (issue #25334)
        let crossFilter;
        if (hasDimensions) {
          crossFilter = getCrossFilterDataMask(seriesName);
        } else if (
          canCrossFilterByXAxis &&
          xAxis.type === AxisType.Category &&
          eventParams.componentType === 'series'
        ) {
          const categoryAxisValue = getXAxisValue(data, eventParams.name);
          if (categoryAxisValue !== undefined) {
            crossFilter = getXAxisCrossFilterDataMask(categoryAxisValue);
          }
        } else if (
          canCrossFilterByXAxis &&
          xAxis.type === AxisType.Time &&
          eventParams.componentType === 'series'
        ) {
          const timeAxisValue = getXAxisValue(data, eventParams.name);
          if (timeAxisValue !== undefined) {
            const timestamp = getTimestampFromTimeAxisValue(timeAxisValue);
            if (timestamp !== undefined) {
              crossFilter = getTimeAxisCrossFilterDataMask(timestamp);
            }
          }
        }

        onContextMenu(pointerEvent.clientX, pointerEvent.clientY, {
          drillToDetail: drillToDetailFilters,
          drillBy: {
            filters: drillByFilters,
            groupbyFieldName: 'groupby',
            ...(xAxisFilters.length > 0 && { xAxisFilters }),
          },
          crossFilter,
        });
      }
    },
  };

  const handleXAxisLabelClick = useCallback(
    (event: ECElementEvent) => {
      const { value } = event;
      if (
        canCrossFilterByXAxis &&
        event.targetType === 'axisLabel' &&
        (typeof value === 'string' || typeof value === 'number')
      ) {
        if (xAxis.type === AxisType.Time) {
          const timestamp = getTimestampFromTimeAxisValue(value);
          if (timestamp !== undefined) {
            handleTimeAxisChange(timestamp);
          }
        } else {
          handleXAxisChange(value);
        }
      }
    },
    [
      canCrossFilterByXAxis,
      handleTimeAxisChange,
      handleXAxisChange,
      xAxis.type,
    ],
  );

  const renderedXAxis =
    formData.orientation === OrientationType.Horizontal ? 'yAxis' : 'xAxis';

  const queryEventHandlers = useMemo(
    () => [
      {
        name: 'click',
        query: renderedXAxis,
        handler: handleXAxisLabelClick,
      },
    ],
    [renderedXAxis, handleXAxisLabelClick],
  );

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
        // @ts-expect-error
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

  const dispatchLegendAction = useCallback(
    (action: { name?: string; seriesName?: string; type: string }) => {
      echartRef.current?.getEchartInstance()?.dispatchAction(action);
    },
    [],
  );

  const chartBodyHeight = Math.max(height - extraControlHeight, 0);
  const customLegendMaxHeight = customLegend
    ? getTimeseriesLegendMaxHeight(chartBodyHeight, customLegend.grid)
    : 0;
  const shouldRenderCustomLegend =
    customLegend !== undefined &&
    chartBodyHeight > TIMESERIES_CONSTANTS.compactChartHeight &&
    customLegendMaxHeight > 0;
  const chartEchartOptions = useMemo(
    () =>
      getViableTimeseriesEchartOptions(
        echartOptions,
        chartBodyHeight,
        formData.zoomable,
      ),
    [chartBodyHeight, echartOptions, formData.zoomable],
  );
  const renderEchart = ({
    chartHeight,
    chartWidth,
  }: {
    chartHeight: number;
    chartWidth: number;
  }) => (
    <Echart
      ref={echartRef}
      refs={refs}
      height={chartHeight}
      width={chartWidth}
      echartOptions={chartEchartOptions}
      eventHandlers={eventHandlers}
      queryEventHandlers={queryEventHandlers}
      zrEventHandlers={zrEventHandlers}
      selectedValues={selectedValues}
      vizType={formData.vizType}
    />
  );

  return (
    <>
      <div ref={extraControlRef}>
        <ExtraControls formData={formData} setControlValue={setControlValue} />
      </div>
      {customLegend && shouldRenderCustomLegend ? (
        <WithLegend
          height={chartBodyHeight}
          position={customLegend.orientation}
          width={width}
          renderLegend={() => (
            <TimeseriesLegend
              {...customLegend}
              maxHeight={customLegendMaxHeight}
              onAll={() => dispatchLegendAction({ type: 'legendAllSelect' })}
              onHover={name =>
                dispatchLegendAction({
                  seriesName: name ?? undefined,
                  type: name === null ? 'downplay' : 'highlight',
                })
              }
              onInverse={() =>
                dispatchLegendAction({ type: 'legendInverseSelect' })
              }
              onToggle={name =>
                dispatchLegendAction({ name, type: 'legendToggleSelect' })
              }
            />
          )}
          renderChart={({ height: chartHeight, width: chartWidth }) =>
            renderEchart({ chartHeight, chartWidth })
          }
        />
      ) : (
        renderEchart({ chartHeight: chartBodyHeight, chartWidth: width })
      )}
    </>
  );
}
