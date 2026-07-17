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
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useCallback,
  Ref,
  useState,
} from 'react';
import { useSelector } from 'react-redux';

import { styled, useTheme } from '@apache-superset/core/theme';
import { use, init, EChartsType, registerLocale } from 'echarts/core';
import {
  SankeyChart,
  PieChart,
  BarChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  LineChart,
  ScatterChart,
  RadarChart,
  BoxplotChart,
  TreeChart,
  TreemapChart,
  HeatmapChart,
  SunburstChart,
  CustomChart,
} from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import {
  TooltipComponent,
  TitleComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  DataZoomComponent,
  type DataZoomComponentOption,
  ToolboxComponent,
  GraphicComponent,
  AriaComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import {
  EchartsHandler,
  EchartsProps,
  EchartsStylesProps,
  QueryEventHandlers,
} from '../types';
import { DEFAULT_LOCALE } from '../constants';
import { mergeEchartsThemeOverrides } from '../utils/themeOverrides';

// Define this interface here to avoid creating a dependency back to superset-frontend,
// TODO: to move the type to @superset-ui/core
interface ExplorePageState {
  common?: {
    locale?: string;
  };
  dashboardState?: {
    isRefreshing?: boolean;
  };
}

const Styles = styled.div<EchartsStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

// eslint-disable-next-line react-hooks/rules-of-hooks -- This is ECharts' use function, not a React hook
use([
  CanvasRenderer,
  BarChart,
  BoxplotChart,
  CustomChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  TreeChart,
  TreemapChart,
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  TitleComponent,
  VisualMapComponent,
  LabelLayout,
]);

const loadLocale = async (locale: string) => {
  let lang;
  try {
    lang = await import(`echarts/i18n/lang${locale}.js`);
  } catch {
    // Locale not supported in ECharts
  }
  return lang?.default;
};

// Report/thumbnail screenshots use standalone="true" (charts) or 3 (reports);
// live embeds use 1/2 and keep animation. See superset/utils/screenshots.py.
export function isReportScreenshotMode(): boolean {
  try {
    const standalone = new URLSearchParams(window.location.search).get(
      'standalone',
    );
    return standalone === 'true' || standalone === '3';
  } catch {
    return false;
  }
}

function Echart(
  {
    width,
    height,
    echartOptions,
    eventHandlers,
    queryEventHandlers,
    zrEventHandlers,
    selectedValues = {},
    refs,
    vizType,
  }: EchartsProps,
  ref: Ref<EchartsHandler>,
) {
  const theme = useTheme();
  const divRef = useRef<HTMLDivElement>(null);
  if (refs) {
    // eslint-disable-next-line no-param-reassign
    refs.divRef = divRef;
  }
  const [didMount, setDidMount] = useState(false);
  const chartRef = useRef<EChartsType>();
  const previousQueryEventHandlers = useRef<QueryEventHandlers>([]);
  const currentSelection = useMemo(
    () => Object.keys(selectedValues) || [],
    [selectedValues],
  );
  const previousSelection = useRef<string[]>([]);

  useImperativeHandle(ref, () => ({
    getEchartInstance: () => chartRef.current,
  }));

  const locale = useSelector(
    (state: ExplorePageState) => state?.common?.locale ?? DEFAULT_LOCALE,
  ).toUpperCase();
  const isDashboardRefreshing = useSelector((state: ExplorePageState) =>
    Boolean(state?.dashboardState?.isRefreshing),
  );

  const handleSizeChange = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      if (chartRef.current) {
        chartRef.current.resize({ width, height });
      }
    },
    [],
  );

  useEffect(() => {
    loadLocale(locale).then(localeObj => {
      if (localeObj) {
        registerLocale(locale, localeObj);
      }
      if (!divRef.current) return;
      if (!chartRef.current) {
        // Pass width and height to init to avoid "Can't get DOM width or height" warning
        // since the DOM element may not have its dimensions yet when init is called
        chartRef.current = init(divRef.current, null, {
          locale,
          width,
          height,
        });
      }
      // did mount
      handleSizeChange({ width, height });
      setDidMount(true);
    });
  }, [locale, width, height, handleSizeChange]);

  useEffect(() => {
    if (didMount) {
      previousQueryEventHandlers.current.forEach(({ name, handler }) => {
        chartRef.current?.off(name, handler);
      });
      Object.entries(eventHandlers || {}).forEach(([name, handler]) => {
        chartRef.current?.off(name);
        chartRef.current?.on(name, handler);
      });

      (queryEventHandlers || []).forEach(({ name, query, handler }) => {
        chartRef.current?.on(name, query, handler);
      });
      previousQueryEventHandlers.current = queryEventHandlers || [];

      Object.entries(zrEventHandlers || {}).forEach(([name, handler]) => {
        chartRef.current?.getZr().off(name);
        chartRef.current?.getZr().on(name, handler);
      });

      const getEchartsTheme = (options: any) => {
        const antdTheme = theme;
        const echartsTheme = {
          textStyle: {
            color: antdTheme.colorText,
            fontFamily: antdTheme.fontFamily,
          },
          title: {
            textStyle: { color: antdTheme.colorText },
          },
          legend: {
            textStyle: { color: antdTheme.colorTextSecondary },
            pageTextStyle: {
              color: antdTheme.colorTextSecondary,
            },
            pageIconColor: antdTheme.colorTextSecondary,
            pageIconInactiveColor: antdTheme.colorTextDisabled,
            inactiveColor: antdTheme.colorTextDisabled,
          },
          tooltip: {
            backgroundColor: antdTheme.colorBgContainer,
            textStyle: { color: antdTheme.colorText },
          },
          axisPointer: {
            lineStyle: { color: antdTheme.colorPrimary },
            label: { color: antdTheme.colorText },
          },
        } as any;
        if (options?.xAxis) {
          echartsTheme.xAxis = {
            axisLine: { lineStyle: { color: antdTheme.colorSplit } },
            axisLabel: { color: antdTheme.colorTextSecondary },
            splitLine: { lineStyle: { color: antdTheme.colorSplit } },
            minorSplitLine: {
              lineStyle: { color: antdTheme.colorBorderSecondary },
            },
          };
        }
        if (options?.yAxis) {
          echartsTheme.yAxis = {
            axisLine: { lineStyle: { color: antdTheme.colorSplit } },
            axisLabel: { color: antdTheme.colorTextSecondary },
            splitLine: { lineStyle: { color: antdTheme.colorSplit } },
            minorSplitLine: {
              lineStyle: { color: antdTheme.colorBorderSecondary },
            },
          };
        }
        return echartsTheme;
      };

      const baseTheme = getEchartsTheme(echartOptions);
      const globalOverrides = theme.echartsOptionsOverrides || {};
      const chartOverrides = vizType
        ? theme.echartsOptionsOverridesByChartType?.[vizType] || {}
        : {};

      // Disable animation on auto-refresh and screenshots. Screenshots have no
      // "render finished" signal, so a running draw can be captured mid-frame,
      // producing partial/blank charts.
      const animationOverride =
        isDashboardRefreshing || isReportScreenshotMode()
          ? {
              animation: false,
              animationDuration: 0,
            }
          : {};

      const themedEchartOptions = mergeEchartsThemeOverrides(
        baseTheme,
        echartOptions,
        globalOverrides,
        chartOverrides,
        animationOverride,
      );

      const notMerge = !isDashboardRefreshing;
      chartRef.current?.dispatchAction({ type: 'hideTip' });
      // setOption(notMerge:true) replaces the dataZoom config, dropping any
      // range the user has engaged. Preserve it across the call.
      const previousZoom = notMerge
        ? (
            chartRef.current?.getOption() as {
              dataZoom?: DataZoomComponentOption[];
            }
          )?.dataZoom
        : undefined;
      chartRef.current?.setOption(themedEchartOptions, {
        notMerge,
        replaceMerge: notMerge ? undefined : ['series'],
        // lazyUpdate defers render, causing tooltip crashes on stale shapes (#39247)
        lazyUpdate: false,
      });
      if (previousZoom?.length) {
        // Skip restore when the new option reshapes dataZoom (different count
        // means index-based restore could land on the wrong component).
        const newZoom = (
          chartRef.current?.getOption() as {
            dataZoom?: DataZoomComponentOption[];
          }
        )?.dataZoom;
        if (newZoom?.length === previousZoom.length) {
          const batch = previousZoom
            .map((dz, dataZoomIndex) => ({
              dataZoomIndex,
              start: dz.start,
              end: dz.end,
              startValue: dz.startValue,
              endValue: dz.endValue,
            }))
            .filter(b => {
              const hasAny =
                b.start !== undefined ||
                b.end !== undefined ||
                b.startValue !== undefined ||
                b.endValue !== undefined;
              if (!hasAny) return false;
              // Default full-range zoom is functionally identical to the
              // fresh state setOption already produces — skip the dispatch.
              const isDefaultRange =
                b.start === 0 &&
                b.end === 100 &&
                b.startValue === undefined &&
                b.endValue === undefined;
              return !isDefaultRange;
            });
          if (batch.length) {
            chartRef.current?.dispatchAction({ type: 'dataZoom', batch });
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isDashboardRefreshing intentionally excluded to prevent extra setOption calls
  }, [
    didMount,
    echartOptions,
    eventHandlers,
    queryEventHandlers,
    zrEventHandlers,
    theme,
    vizType,
  ]);

  // Clear tooltip on refresh start to avoid stale content (#39247)
  useEffect(() => {
    if (didMount && isDashboardRefreshing && chartRef.current) {
      chartRef.current.dispatchAction({ type: 'hideTip' });
      chartRef.current.dispatchAction({
        type: 'updateAxisPointer',
        currTrigger: 'leave',
      });
    }
  }, [didMount, isDashboardRefreshing]);

  useEffect(() => () => chartRef.current?.dispose(), []);

  // highlighting
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.dispatchAction({
      type: 'downplay',
      dataIndex: previousSelection.current.filter(
        value => !currentSelection.includes(value),
      ),
    });
    if (currentSelection.length) {
      chartRef.current.dispatchAction({
        type: 'highlight',
        dataIndex: currentSelection,
      });
    }
    previousSelection.current = currentSelection;
  }, [currentSelection]);

  useLayoutEffect(() => {
    handleSizeChange({ width, height });
  }, [width, height, handleSizeChange]);

  return <Styles ref={divRef} height={height} width={width} />;
}

export default forwardRef(Echart);
