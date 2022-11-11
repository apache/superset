import { dispatchChartEvent } from '@superset-ui/core';

export const XYChartClickHandlerCyberhaven = (e: any) => {
  dispatchChartEvent('XYChartClickEvent', e.event.target, e.datum);
};
