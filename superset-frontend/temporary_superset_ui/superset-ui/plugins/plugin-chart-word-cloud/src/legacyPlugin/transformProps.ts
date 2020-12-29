import { ChartProps } from '@superset-ui/core';
import { WordCloudProps, WordCloudEncoding } from '../chart/WordCloud';
import { LegacyWordCloudFormData } from './types';

function getMetricLabel(metric: LegacyWordCloudFormData['metric']): string | undefined {
  if (typeof metric === 'string' || typeof metric === 'undefined') {
    return metric;
  }
  if (Array.isArray(metric)) {
    return metric.length > 0 ? getMetricLabel(metric[0]) : undefined;
  }

  return metric.label;
}

export default function transformProps(chartProps: ChartProps): WordCloudProps {
  const { width, height, formData, queriesData } = chartProps;
  const {
    colorScheme,
    metric,
    rotation,
    series,
    sizeFrom = 0,
    sizeTo,
  } = formData as LegacyWordCloudFormData;

  const metricLabel = getMetricLabel(metric);

  const encoding: Partial<WordCloudEncoding> = {
    color: {
      field: series,
      scale: {
        scheme: colorScheme,
      },
      type: 'nominal',
    },
    fontSize:
      typeof metricLabel === 'undefined'
        ? undefined
        : {
            field: metricLabel,
            scale: {
              range: [sizeFrom, sizeTo],
              zero: true,
            },
            type: 'quantitative',
          },
    text: {
      field: series,
    },
  };

  return {
    data: queriesData[0].data,
    encoding,
    height,
    rotation,
    width,
  };
}
