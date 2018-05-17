import {
  TABS_TYPE,
  CHART_TYPE,
} from './componentTypes';

import {
  DASHBOARD_ROOT_ID,
} from './constants';

export function getChartIdsFromLayout(layout) {
  return Object.values(layout).reduce((chartIds, value) => {
    if (value && value.meta && value.meta.chartId) {
      chartIds.push(value.meta.chartId);
    }
    return chartIds;
  }, []);
}

export function findInitialPageLoadCharts(layout) {
  if (!layout) {
    return [];
  }

  let chartIds = [];
  function doTraverse(node) {
    const type = node.type;
    if (type === CHART_TYPE) {
      if (node.meta && node.meta.chartId) {
        chartIds.push(node.meta.chartId);
      }
    } else if (type === TABS_TYPE) {
      const firstTabKey = node.children[0];
      doTraverse(layout[firstTabKey]);
    } else if (node.children.length) {
      node.children.forEach(id => (doTraverse(layout[id])));
    }
  }

  doTraverse(layout[DASHBOARD_ROOT_ID]);

  return chartIds;
}