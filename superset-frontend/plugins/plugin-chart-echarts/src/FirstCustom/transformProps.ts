import { CategoricalColorNamespace, QueryFormMetric } from '@superset-ui/core';
import { CustomChartProps, CustomChartTransformProps } from './types';

export default function transformProps(
  chartProps: CustomChartProps,
): CustomChartTransformProps {
  const { formData, queriesData, width, height } = chartProps;
  const { data = [] } = queriesData[0] || {};

  const {
    metrics,
    groupBy,
    colorScheme,
    showDataLabels,
    isStacked,
    chartType,
  } = formData;

  // Safely transform the data
  const transformedData = data.map(datum => {
    const name = datum[groupBy[0]] || ''; // Use a fallback to an empty string
    const value = metrics.map((metric: QueryFormMetric) => {
      // Here we need to safely extract values from the datum using metric's id or key
      // Ensure that metric is an object with the correct property
      metrics: Array<{ metric_name: string; }> // Adjust according to your structure
    });

    return {
      name,
      value,
      itemStyle: {
        color: CategoricalColorNamespace.getScale(colorScheme)(name),
      },
      label: showDataLabels ? { show: true } : { show: false },
    };
  });

  // ECharts options configuration remains the same
  const echartOptions = {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        return `${params.name}: ${params.value}`;
      },
    },
    series: [{
      type: chartType,
      data: transformedData,
      stacking: isStacked ? 'normal' : undefined,
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0, 0, 0, 0.5)',
        },
      },
      label: {
        show: showDataLabels,
      },
    }],
    xAxis: {
      type: 'category',
      name: formData.xAxisLabel || '',
    },
    yAxis: {
      type: 'value',
      name: formData.yAxisLabel || '',
    },
  };

  return {
    formData,
    width,
    height,
    echartOptions,
  };
}
