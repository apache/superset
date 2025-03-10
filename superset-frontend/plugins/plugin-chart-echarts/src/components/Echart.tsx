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
} from 'react';

import { useSelector } from 'react-redux';

import { styled } from '@superset-ui/core';
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
} from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import {
  TooltipComponent,
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
  VisualMapComponent,
  LabelLayout,
]);

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
  const divRef = useRef<HTMLDivElement>(null);
  if (refs) {
    // eslint-disable-next-line no-param-reassign
    refs.divRef = divRef;
  }
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
    const loadLocaleAndInitChart = async () => {
      if (!divRef.current) return;

      const lang = await import(`echarts/lib/i18n/lang${locale}`).catch(e => {
        console.error(`Locale ${locale} not supported in ECharts`, e);
      });
      if (lang?.default) {
        registerLocale(locale, lang.default);
      }

      if (!chartRef.current) {
        chartRef.current = init(divRef.current, null, { locale });
      }

      Object.entries(eventHandlers || {}).forEach(([name, handler]) => {
        chartRef.current?.off(name);
        chartRef.current?.on(name, handler);
      });

      Object.entries(zrEventHandlers || {}).forEach(([name, handler]) => {
        chartRef.current?.getZr().off(name);
        chartRef.current?.getZr().on(name, handler);
      });

      chartRef.current.setOption(echartOptions, true);

      // did mount
      handleSizeChange({ width, height });
    };

    loadLocaleAndInitChart();
  }, [echartOptions, eventHandlers, zrEventHandlers, locale]);

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
