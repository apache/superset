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

import { styled, t } from '@superset-ui/core';
import { use, init, EChartsType } from 'echarts/core';
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

  useEffect(() => {
    if (!divRef.current) return;
    if (!chartRef.current) {
      chartRef.current = init(divRef.current, null, {
        locale: {
          time: {
            month: [
              t('January'),
              t('February'),
              t('March'),
              t('April'),
              t('May'),
              t('June'),
              t('July'),
              t('August'),
              t('September'),
              t('October'),
              t('November'),
              t('December'),
            ],
            monthAbbr: [
              t('Jan'),
              t('Feb'),
              t('Mar'),
              t('Apr'),
              t('May'),
              t('Jun'),
              t('Jul'),
              t('Aug'),
              t('Sep'),
              t('Oct'),
              t('Nov'),
              t('Dec'),
            ],
            dayOfWeek: [
              t('Sunday'),
              t('Monday'),
              t('Tuesday'),
              t('Wednesday'),
              t('Thursday'),
              t('Friday'),
              t('Saturday'),
            ],
            dayOfWeekAbbr: [
              t('Sun'),
              t('Mon'),
              t('Tue'),
              t('Wed'),
              t('Thu'),
              t('Fri'),
              t('Sat'),
            ],
          },
          legend: {
            selector: {
              all: t('All'),
              inverse: t('Inv'),
            },
          },
          toolbox: {
            brush: {
              title: {
                rect: t('Box Select'),
                polygon: t('Lasso Select'),
                lineX: t('Horizontally Select'),
                lineY: t('Vertically Select'),
                keep: t('Keep Selections'),
                clear: t('Clear Selections'),
              },
            },
            dataView: {
              title: t('Data View'),
              lang: [t('Data View'), t('Close'), t('Refresh')],
            },
            dataZoom: {
              title: {
                zoom: t('Zoom'),
                back: t('Zoom Reset'),
              },
            },
            magicType: {
              title: {
                line: t('Switch to Line Chart'),
                bar: t('Switch to Bar Chart'),
                stack: t('Stack'),
                tiled: t('Tile'),
              },
            },
            restore: {
              title: t('Restore'),
            },
            saveAsImage: {
              title: t('Save as Image'),
              lang: [t('Right Click to Save Image')],
            },
          },
          series: {
            typeNames: {
              pie: t('Pie chart'),
              bar: t('Bar chart'),
              line: t('Line chart'),
              scatter: t('Scatter plot'),
              effectScatter: t('Ripple scatter plot'),
              radar: t('Radar chart'),
              tree: t('Tree'),
              treemap: t('Treemap'),
              boxplot: t('Boxplot'),
              candlestick: t('Candlestick'),
              k: t('K line chart'),
              heatmap: t('Heat map'),
              map: t('Map'),
              parallel: t('Parallel coordinate map'),
              lines: t('Line graph'),
              graph: t('Relationship graph'),
              sankey: t('Sankey diagram'),
              funnel: t('Funnel chart'),
              gauge: t('Gauge'),
              pictorialBar: t('Pictorial bar'),
              themeRiver: t('Theme River Map'),
              sunburst: t('Sunburst'),
              custom: t('Custom chart'),
              chart: t('Chart'),
            },
          },
          aria: {
            general: {
              withTitle: t('This is a chart about "{title}"'),
              withoutTitle: t('This is a chart'),
            },
            series: {
              single: {
                prefix: '',
                withName: t(' with type {seriesType} named {seriesName}.'),
                withoutName: t(' with type {seriesType}.'),
              },
              multiple: {
                prefix: t('. It consists of {seriesCount} series count.'),
                withName: t(
                  ' The {seriesId} series is a {seriesType} representing {seriesName}.',
                ),
                withoutName: t(' The {seriesId} series is a {seriesType}.'),
                separator: {
                  middle: '',
                  end: '',
                },
              },
            },
            data: {
              allData: t('The data is as follows: '),
              partialData: t('The first {displayCnt} items are: '),
              withName: t('the data for {name} is {value}'),
              withoutName: '{value}',
              separator: {
                middle: ', ',
                end: '. ',
              },
            },
          },
        },
      });
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
  }, [echartOptions, eventHandlers, zrEventHandlers]);

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

  const handleSizeChange = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      if (chartRef.current) {
        chartRef.current.resize({ width, height });
      }
    },
    [],
  );

  // did mount
  useEffect(() => {
    handleSizeChange({ width, height });
    return () => chartRef.current?.dispose();
  }, []);

  useLayoutEffect(() => {
    handleSizeChange({ width, height });
  }, [width, height, handleSizeChange]);

  return <Styles ref={divRef} height={height} width={width} />;
}

export default forwardRef(Echart);
