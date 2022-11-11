import { dispatchChartEvent } from '@superset-ui/core';

export const getRowClickHandlerCyberhaven = (row: object) => (e: any) => {
  dispatchChartEvent('tableClickEvent', e.target, row);
};
