import React from 'react';
import { SuperChart, getChartTransformPropsRegistry } from '@superset-ui/chart';
import { select, withKnobs } from '@storybook/addon-knobs';
import {
  WordCloudChartPlugin,
  LegacyWordCloudChartPlugin,
} from '@superset-ui/plugin-chart-word-cloud';
import transformProps from '@superset-ui/plugin-chart-word-cloud/lib/plugin/transformProps';
import data from './data';

new WordCloudChartPlugin().configure({ key: 'word-cloud2' }).register();
new LegacyWordCloudChartPlugin().configure({ key: 'legacy-word-cloud2' }).register();

// Enable the new WordCloud Props to show case its full features
// if the control panel is updated to be able to pass formData in the new format.
getChartTransformPropsRegistry().registerValue('word-cloud2', transformProps);

export default {
  title: 'Chart Plugins|plugin-chart-word-cloud',
  decorators: [withKnobs],
};

export const basic = () => (
  <SuperChart
    chartType="word-cloud2"
    width={400}
    height={400}
    queryData={{ data }}
    formData={{
      encoding: {
        color: {
          value: '#0097e6',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [0, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
    }}
  />
);

export const encodesColorByWordLength = () => (
  <SuperChart
    chartType="word-cloud2"
    width={400}
    height={400}
    queryData={{ data }}
    formData={{
      encoding: {
        color: {
          field: 'name.length',
          scale: {
            range: ['#fbc531', '#c23616'],
            type: 'linear',
            zero: false,
          },
          type: 'quantitative',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [0, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
    }}
  />
);

export const encodesFontByFirstLetter = () => (
  <SuperChart
    chartType="word-cloud2"
    width={400}
    height={400}
    queryData={{ data }}
    formData={{
      encoding: {
        color: {
          value: '#8c7ae6',
        },
        fontFamily: {
          field: 'name[0]',
          scale: {
            range: ['Helvetica', 'Monaco'],
            type: 'ordinal',
          },
          type: 'nominal',
        },
        fontSize: {
          field: 'sum__num',
          scale: {
            range: [0, 70],
            zero: true,
          },
          type: 'quantitative',
        },
        text: {
          field: 'name',
        },
      },
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
    }}
  />
);

export const legacyShim = () => (
  <SuperChart
    chartType="legacy-word-cloud2"
    width={400}
    height={400}
    queryData={{ data }}
    formData={{
      colorScheme: 'd3Category10',
      metric: 'sum__num',
      rotation: select('Rotation', ['square', 'flat', 'random'], 'flat'),
      series: 'name',
      sizeFrom: '10',
      sizeTo: '70',
    }}
  />
);
