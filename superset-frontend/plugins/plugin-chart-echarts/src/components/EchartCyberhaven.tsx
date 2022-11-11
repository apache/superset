import { ECharts } from 'echarts';
import { dispatchChartEvent } from '@superset-ui/core';

export const echartSettings = { renderer: 'svg' as any };

export const onChartClick = (
  ref: ECharts,
  divRef: React.RefObject<HTMLDivElement>,
) => {
  ref.on('click', event => {
    const eventCopy = { ...event };
    eventCopy.event = undefined;
    dispatchChartEvent('chartClickEvent', divRef.current, eventCopy);
  });
};
