import { getNumberFormatter } from '@superset-ui/number-format';
import { getTimeFormatter } from '@superset-ui/time-format';

/* eslint-disable sort-keys */

export default function transformProps(chartProps) {
  const { width, height, datasource = {}, formData, payload } = chartProps;
  const { verboseMap = {} } = datasource;
  const {
    colorScheme,
    groupby,
    metrics,
    xAxisLabel,
    xAxisFormat,
    yAxisLabel,
    yAxisFormat,
  } = formData;

  return {
    data: payload.data,
    width,
    height,
    encoding: {
      x: {
        accessor: d => d.x,
        scale: {
          type: 'time',
        },
        axis: {
          orientation: 'bottom',
          label: xAxisLabel,
          numTicks: 5,
          tickFormat: getTimeFormatter(xAxisFormat),
        },
      },
      y: {
        accessor: d => d.y,
        scale: {
          type: 'linear',
        },
        axis: {
          orientation: 'left',
          label: yAxisLabel,
          tickFormat: getNumberFormatter(yAxisFormat),
        },
      },
      color: {
        accessor: d => d.key.join('/'),
        scale: {
          scheme: colorScheme,
        },
        legend: true,
      },
    },
  };
}
