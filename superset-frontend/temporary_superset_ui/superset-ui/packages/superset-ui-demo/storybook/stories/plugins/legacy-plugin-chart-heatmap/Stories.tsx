import React from 'react';
import { SuperChart } from '@superset-ui/core';
import HeatmapChartPlugin from '@superset-ui/legacy-plugin-chart-heatmap';
import ResizableChartDemo from '../../../shared/components/ResizableChartDemo';
import data from './data';

new HeatmapChartPlugin().configure({ key: 'heatmap' }).register();

export default {
  title: 'Legacy Chart Plugins|legacy-plugin-chart-heatmap',
};

export const basic = () => (
  <SuperChart
    chartType="heatmap"
    width={500}
    height={500}
    formData={{
      allColumnsX: 'source',
      allColumnsY: 'target',
      bottomMargin: 'auto',
      canvasImageRendering: 'pixelated',
      leftMargin: 'auto',
      linearColorScheme: 'blue_white_yellow',
      metric: 'sum__value',
      normalized: false,
      showLegend: true,
      showPerc: true,
      showValues: false,
      sortXAxis: 'alpha_asc',
      sortYAxis: 'alpha_asc',
      xscaleInterval: '1',
      yAxisBounds: [null, null],
      yAxisFormat: '.3s',
      yscaleInterval: '1',
    }}
    queriesData={[
      {
        data: {
          records: data,
          extents: [0.1, 24.9],
        },
      },
    ]}
  />
);

export const resizable = () => (
  <ResizableChartDemo>
    {({ width, height }) => (
      <SuperChart
        chartType="heatmap"
        width={width}
        height={height}
        formData={{
          allColumnsX: 'source',
          allColumnsY: 'target',
          bottomMargin: 'auto',
          canvasImageRendering: 'pixelated',
          leftMargin: 'auto',
          linearColorScheme: 'blue_white_yellow',
          metric: 'sum__value',
          normalized: false,
          showLegend: true,
          showPerc: true,
          showValues: false,
          sortXAxis: 'alpha_asc',
          sortYAxis: 'alpha_asc',
          xscaleInterval: '1',
          yAxisBounds: [null, null],
          yAxisFormat: '.3s',
          yscaleInterval: '1',
        }}
        queriesData={[
          {
            data: {
              records: data,
              extents: [0.1, 24.9],
            },
          },
        ]}
      />
    )}
  </ResizableChartDemo>
);

export const withNullData = () => (
  <SuperChart
    chartType="heatmap"
    width={500}
    height={500}
    formData={{
      allColumnsX: 'source',
      allColumnsY: 'target',
      bottomMargin: 'auto',
      canvasImageRendering: 'pixelated',
      leftMargin: 'auto',
      linearColorScheme: 'blue_white_yellow',
      metric: 'sum__value',
      normalized: false,
      showLegend: true,
      showPerc: true,
      showValues: false,
      sortXAxis: 'alpha_asc',
      sortYAxis: 'alpha_asc',
      xscaleInterval: '1',
      yAxisBounds: [null, null],
      yAxisFormat: '.3s',
      yscaleInterval: '1',
    }}
    queriesData={[
      {
        data: {
          records: [
            ...data,
            {
              x: null,
              y: 'Electricity and heat',
              v: 25.9,
              perc: 0.43,
              rank: 1.0,
            },
          ],
          extents: [0.1, 24.9],
        },
      },
    ]}
  />
);
