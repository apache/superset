import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/core';
import { boolean, number, text, select, withKnobs } from '@storybook/addon-knobs';
import { EchartsTimeseriesChartPlugin } from '@superset-ui/plugin-chart-echarts';
import transformProps from '@superset-ui/plugin-chart-echarts/lib/MixedTimeseries/transformProps';
import data from '../Timeseries/data';
import { withResizableChartDemo } from '../../../../shared/components/ResizableChartDemo';

new EchartsTimeseriesChartPlugin().configure({ key: 'mixed-timeseries' }).register();

getChartTransformPropsRegistry().registerValue('mixed-timeseries', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-echarts/MixedTimeseries',
  decorators: [withKnobs, withResizableChartDemo],
};

export const Timeseries = ({ width, height }) => {
  const queriesData = [
    {
      data: data
        .map(row => ({
          // eslint-disable-next-line no-underscore-dangle
          __timestamp: row.__timestamp,
          Boston: row.Boston,
        }))
        .filter(row => !!row.Boston),
    },
    {
      data: data
        .map(row => ({
          // eslint-disable-next-line no-underscore-dangle
          __timestamp: row.__timestamp,
          California: row.California,
          WestTexNewMexico: row.WestTexNewMexico,
        }))
        .filter(row => !!row.California),
    },
  ];
  return (
    <SuperChart
      chartType="mixed-timeseries"
      width={width}
      height={height}
      queriesData={queriesData}
      formData={{
        contributionMode: undefined,
        colorScheme: 'supersetColors',
        zoomable: boolean('Zoomable', false),
        logAxis: boolean('Log axis', false),
        xAxisTimeFormat: 'smart_date',
        tooltipTimeFormat: 'smart_date',
        yAxisFormat: 'SMART_NUMBER',
        yAxisTitle: text('Y Axis title', ''),
        minorSplitLine: boolean('Query 1: Minor splitline', false),
        seriesType: select(
          'Query 1: Line type',
          ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
          'line',
        ),
        stack: boolean('Query 1: Stack', false),
        area: boolean('Query 1: Area chart', false),
        markerEnabled: boolean('Query 1: Enable markers', false),
        markerSize: number('Query 1: Marker Size', 6),
        opacity: number('Query 1: Opacity', 0.2),
        seriesTypeB: select(
          'Query 2: Line type',
          ['line', 'scatter', 'smooth', 'bar', 'start', 'middle', 'end'],
          'bar',
        ),
        stackB: boolean('Query 2: Stack', false),
        areaB: boolean('Query 2: Area chart', false),
        markerEnabledB: boolean('Query 2: Enable markers', false),
        markerSizeB: number('Query 2: Marker Size', 6),
        opacityB: number('Query 2: Opacity', 0.2),
      }}
    />
  );
};
