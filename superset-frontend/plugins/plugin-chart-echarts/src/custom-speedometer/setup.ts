import { ChartPlugin } from '@superset-ui/core';

export default function setup(pluginProps: any) {
  return new SpeedoChartPlugin({
    buildQuery: (formData) => {
      const { metrics, minVal, maxVal, progress } = formData;
      return [
        {
          metrics: [metrics],
          filters: [],
          extras: { minVal, maxVal },
          progress,
        },
      ];
    },
    ...pluginProps,
  });
}
