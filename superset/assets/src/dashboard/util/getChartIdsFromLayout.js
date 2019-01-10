import { CHART_TYPE } from './componentTypes';

export default function getChartIdsFromLayout(layout) {
  return Object.values(layout).reduce((chartIds, currentComponent) => {
    if (
      currentComponent &&
      currentComponent.type === CHART_TYPE &&
      currentComponent.meta &&
      currentComponent.meta.chartId
    ) {
      chartIds.push(currentComponent.meta.chartId);
    }
    return chartIds;
  }, []);
}
