import { ChartProps } from '@superset-ui/chart';
import { flatMap } from 'lodash';

interface DataRow {
  key: string[];
  values: {
    [key: string]: any;
  }[];
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queryData } = chartProps;
  const {
    colorScheme,
    entity,
    maxBubbleSize,
    series,
    showLegend,
    size,
    x,
    xAxisFormat,
    xAxisLabel,
    // TODO: These fields are not supported yet
    // xAxisShowminmax,
    // xLogScale,
    y,
    yAxisLabel,
    yAxisFormat,
    // TODO: These fields are not supported yet
    // yAxisShowminmax,
    // yLogScale,
  } = formData;
  const data = queryData.data as DataRow[];

  return {
    data: flatMap(
      data.map((row: DataRow) =>
        row.values.map(v => ({
          [x]: v[x],
          [y]: v[y],
          [series]: v[series],
          [size]: v[size],
          [entity]: v[entity],
        })),
      ),
    ),
    width,
    height,
    encoding: {
      x: {
        field: x,
        type: 'quantitive',
        format: xAxisFormat,
        scale: {
          type: 'linear',
        },
        axis: {
          orient: 'bottom',
          title: xAxisLabel,
        },
      },
      y: {
        field: y,
        type: 'quantitative',
        format: yAxisFormat,
        scale: {
          type: 'linear',
        },
        axis: {
          orient: 'left',
          title: yAxisLabel,
        },
      },
      size: {
        field: size,
        type: 'quantitative',
        scale: {
          type: 'linear',
          range: [0, maxBubbleSize],
        },
      },
      fill: {
        field: series,
        type: 'nominal',
        scale: {
          scheme: colorScheme,
        },
        legend: showLegend,
      },
      group: [{ field: entity }],
    },
  };
}
