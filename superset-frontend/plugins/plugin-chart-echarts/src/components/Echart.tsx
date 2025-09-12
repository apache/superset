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
import { merge } from 'lodash';

import { useSelector } from 'react-redux';

import { styled, useTheme } from '@superset-ui/core';
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
  common: {
    locale: string;
  };
}

const Styles = styled.div<EchartsStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

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
    lang = await import(`echarts/lib/i18n/lang${locale}`);
  } catch (e) {
    console.error(`Locale ${locale} not supported in ECharts`, e);
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
        chartRef.current = init(divRef.current, null, { locale });
      }
      // did mount
      handleSizeChange({ width, height });
      setDidMount(true);
    });
  }, [locale]);

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
          };
        }
        if (options?.yAxis) {
          echartsTheme.yAxis = {
            axisLine: { lineStyle: { color: antdTheme.colorSplit } },
            axisLabel: { color: antdTheme.colorTextSecondary },
            splitLine: { lineStyle: { color: antdTheme.colorSplit } },
          };
        }
        return echartsTheme;
      };

      const themedEchartOptions = merge(
        {},
        getEchartsTheme(echartOptions),
        echartOptions,
      );
      chartRef.current?.setOption(themedEchartOptions, true);
    }
  }, [didMount, echartOptions, eventHandlers, zrEventHandlers, theme]);

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
  }, [currentSelection, chartRef.current]);

  useLayoutEffect(() => {
    handleSizeChange({ width, height });
  }, [width, height, handleSizeChange]);

  return <Styles ref={divRef} height={height} width={width} />;
}

export default forwardRef(Echart);
