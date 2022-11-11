import { dispatchChartEvent } from '@superset-ui/core';

export const getRowClickHandlerCyberhaven = (rowAttrs, rowKey) => e => {
  const eventData = {
    headerKeys: rowAttrs,
    keyValues: rowKey,
  };

  for (let i = 0; i < rowAttrs.length; i += 1) {
    eventData[rowAttrs[i]] = rowKey[i];
  }
  dispatchChartEvent('pivotTableClickEvent', e.target, eventData);
};
