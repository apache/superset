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
import { t } from '@superset-ui/core';
import { init as echartsInit } from 'echarts';
import { createRef, FC, useEffect } from 'react';
import { ZoomConfigsChartProps } from './types';
import {
  createDragGraphicOptions,
  dataToZoomConfigs,
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  zoomConfigsToData,
} from './zoomUtil';

export const ZoomConfigsChart: FC<ZoomConfigsChartProps> = ({
  value,
  onChange = () => {},
}) => {
  const ref = createRef<HTMLDivElement>();

  useEffect(() => {
    if (!ref.current) {
      return undefined;
    }
    // TODO check if this can be applied here
    if (value === null || value === undefined) {
      return undefined;
    }

    let timer: number;

    const barWidth = 15;
    const data = zoomConfigsToData(value.values);

    const chart = echartsInit(ref.current);

    const option = {
      xAxis: {
        min: 0,
        name: t('Size in pixels'),
        nameLocation: 'center',
        nameGap: 25,
      },
      yAxis: {
        type: 'category',
        min: MIN_ZOOM_LEVEL,
        max: MAX_ZOOM_LEVEL,
        name: t('Zoom level'),
        nameLocation: 'center',
        nameRotate: 90,
        nameGap: 25,
      },
      dataset: {
        dimensions: ['width', 'height', 'zoom'],
        source: data,
      },
      grid: {
        top: 12,
        left: 40,
      },
      series: [
        {
          id: 'width',
          name: 'width',
          type: 'bar',
          animation: false,
          showBackground: true,
          barWidth,
          barGap: '0%',
          label: {
            show: true,
            formatter: '{a}: {@width}',
          },
          encode: {
            x: 'width',
            y: 'zoom',
          },
        },
        {
          id: 'height',
          name: 'height',
          type: 'bar',
          animation: false,
          showBackground: true,
          barWidth,
          barGap: '0%',
          label: {
            show: true,
            formatter: '{a}: {@height}',
          },
          encode: {
            x: 'height',
            y: 'zoom',
          },
        },
      ],
    };

    chart.setOption(option);

    const onDrag = function (
      this: any,
      dataIndex: number | undefined,
      itemIndex: number,
    ) {
      if (dataIndex === undefined) {
        return;
      }

      // eslint-disable-next-line react/no-this-in-sfc
      const newPosition = chart.convertFromPixel('grid', [this.x, this.y]);
      if (typeof newPosition === 'number') {
        return;
      }

      const roundedPosition = Math.round(newPosition[0]);
      const newRoundedPosition = roundedPosition < 0 ? 0 : roundedPosition;
      data[dataIndex][itemIndex] = newRoundedPosition;
      chart.setOption({
        dataset: {
          source: data,
        },
      });
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        const newValues = dataToZoomConfigs(data);
        onChange({ ...value, values: newValues });
      }, 200);
    };

    const onWidthDrag = function (this: any, dataIndex: number | undefined) {
      onDrag.call(this, dataIndex, 0);
    };
    const onHeightDrag = function (this: any, dataIndex: number | undefined) {
      onDrag.call(this, dataIndex, 1);
    };

    // TODO listen to resize event and redraw chart
    // TODO rearrange the draghandlers when the chart range changes
    chart.setOption({
      graphic: createDragGraphicOptions({
        data,
        onWidthDrag,
        onHeightDrag,
        barWidth,
        chart,
      }),
    });
    // chart.on('click', 'series', (params) => {
    //   const clickedData: number[] = params.data as number[];
    //   const zoomLevel: number = clickedData[2];
    //   // TODO we have to set a flag on value that indicates, which zoomLevel should be active
    //   // TODO maybe it's better to add a callback to the map that triggers when the zoom
    //   //      in the map changes. This can then be displayed on the zoom chart.
    // });

    return () => {
      clearTimeout(timer);
    };
  }, [value]);

  return <div ref={ref} style={{ height: '1300px', width: '100%' }} />;
};

export default ZoomConfigsChart;
