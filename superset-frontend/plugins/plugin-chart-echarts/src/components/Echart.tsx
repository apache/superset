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

import { mergeReplaceArrays } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
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
import { SVGRenderer } from 'echarts/renderers';
import {
  TooltipComponent,
  TitleComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  GraphicComponent,
  AriaComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { EchartsHandler, EchartsProps, EchartsStylesProps } from '../types';
import { DEFAULT_LOCALE } from '../constants';

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
  SVGRenderer,
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
    lang = await import(`echarts/lib/i18n/lang${locale}`);
  } catch {
    // Locale not supported in ECharts
  }
  return lang?.default;
};

function Echart(
  {
    width,
    height,
    echartOptions,
    eventHandlers,
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
        chartRef.current = init(divRef.current, null, { locale, renderer: 'svg' });
      }
      // did mount
      handleSizeChange({ width, height });
      setDidMount(true);
    });
  }, [locale, width, height, handleSizeChange]);

  useEffect(() => {
    if (didMount) {
      Object.entries(eventHandlers || {}).forEach(([name, handler]) => {
        chartRef.current?.off(name);
        chartRef.current?.on(name, handler);
      });

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
            // WCAG 1.4.13: Make chart tooltips hoverable (persistent while
            // pointer is over the tooltip itself) so users can interact with
            // or read the content without it disappearing.
            enterable: true,
          },
          axisPointer: {
            lineStyle: { color: antdTheme.colorPrimary },
            label: { color: antdTheme.colorText },
          },
        } as any;
        // WCAG 1.4.11: Non-text contrast — axis/grid lines need 3:1 against chart background
        // colorSplit (~#f0f0f0) only has ~1.04:1 on white — replaced with colorTextTertiary (~3.5:1)
        if (options?.xAxis) {
          echartsTheme.xAxis = {
            axisLine: { lineStyle: { color: antdTheme.colorTextTertiary } },
            axisLabel: { color: antdTheme.colorTextSecondary },
            splitLine: { lineStyle: { color: antdTheme.colorTextTertiary } },
          };
        }
        if (options?.yAxis) {
          echartsTheme.yAxis = {
            axisLine: { lineStyle: { color: antdTheme.colorTextTertiary } },
            axisLabel: { color: antdTheme.colorTextSecondary },
            splitLine: { lineStyle: { color: antdTheme.colorTextTertiary } },
          };
        }
        return echartsTheme;
      };

      const baseTheme = getEchartsTheme(echartOptions);
      const globalOverrides = theme.echartsOptionsOverrides || {};
      const chartOverrides = vizType
        ? theme.echartsOptionsOverridesByChartType?.[vizType] || {}
        : {};

      // Disable animations during auto-refresh to reduce visual noise
      const animationOverride = isDashboardRefreshing
        ? {
            animation: false,
            animationDuration: 0,
          }
        : {};

      // WCAG: Enable ECharts built-in aria module for screen-reader descriptions
      const ariaOptions = {
        aria: {
          enabled: true,
          decal: { show: false }, // visual patterns handled separately by color
          label: {
            enabled: true,
            description:
              (echartOptions as any).title?.text || 'Chart data',
          },
        },
      };

      const themedEchartOptions = mergeReplaceArrays(
        baseTheme,
        echartOptions,
        globalOverrides,
        chartOverrides,
        animationOverride,
        ariaOptions,
      );

      // WCAG 1.4.11: Ensure chart series lines have sufficient visual weight.
      // Thin lines (1px) with lighter colors may fail the 3:1 non-text contrast
      // ratio. Enforce a minimum lineWidth of 2 for all line-type series.
      if (Array.isArray(themedEchartOptions.series)) {
        themedEchartOptions.series = themedEchartOptions.series.map(
          (s: any) => {
            if (s?.type === 'line' && (!s.lineStyle?.width || s.lineStyle?.width < 2)) {
              return {
                ...s,
                lineStyle: { ...s.lineStyle, width: 2 },
              };
            }
            return s;
          },
        );
      }

      const notMerge = !isDashboardRefreshing;
      if (!notMerge) {
        chartRef.current?.dispatchAction({ type: 'hideTip' });
      }
      chartRef.current?.setOption(themedEchartOptions, {
        notMerge,
        replaceMerge: notMerge ? undefined : ['series'],
        lazyUpdate: isDashboardRefreshing,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isDashboardRefreshing intentionally excluded to prevent extra setOption calls
  }, [didMount, echartOptions, eventHandlers, zrEventHandlers, theme, vizType]);

  useEffect(() => () => chartRef.current?.dispose(), []);

  // WCAG 1.4.13: Dismiss ECharts tooltip on Escape key
  useEffect(() => {
    const el = divRef.current;
    if (!el) return undefined;

    const handleKeyDown = (e: Event) => {
      if ((e as globalThis.KeyboardEvent).key === 'Escape' && chartRef.current) {
        chartRef.current.dispatchAction({ type: 'hideTip' });
      }
    };

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [didMount]);

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

  const chartLabel =
    (echartOptions as any).title?.text || 'Data visualization';

  return (
    <Styles
      ref={divRef}
      height={height}
      width={width}
      role="img"
      aria-label={chartLabel}
    />
  );
}

export default forwardRef(Echart);
