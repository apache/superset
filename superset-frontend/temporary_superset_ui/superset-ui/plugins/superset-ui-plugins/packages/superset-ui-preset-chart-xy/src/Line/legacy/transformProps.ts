/* eslint-disable sort-keys */
import { ChartProps } from '@superset-ui/chart';
import { flatMap } from 'lodash';

interface DataRow {
  key: string[];
  values: {
    x: number;
    y: number;
  }[];
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, payload } = chartProps;
  const { colorScheme, xAxisLabel, xAxisFormat, yAxisLabel, yAxisFormat } = formData;
  const data = payload.data as DataRow[];

  return {
    data: flatMap(
      data.map((row: DataRow) =>
        row.values.map(v => ({
          ...v,
          name: row.key[0],
        })),
      ),
    ),
    width,
    height,
    encoding: {
      x: {
        field: 'x',
        type: 'temporal',
        format: xAxisFormat,
        scale: {
          type: 'time',
        },
        axis: {
          orient: 'bottom',
          title: xAxisLabel,
        },
      },
      y: {
        field: 'y',
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
      stroke: {
        field: 'name',
        type: 'nominal',
        scale: {
          scheme: colorScheme,
        },
        legend: true,
      },
    },
  };
}
