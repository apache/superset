let localStorageFeatures = {};

if (typeof window !== 'undefined') {
  try {
    localStorageFeatures = JSON.parse(localStorage.getItem('CH_FEATURES')!);
  } catch {
    localStorageFeatures = {};
  }
}

export const CH_FEATURES = {
  ECHART: true,
  XYCHART: true,
  PIVOT_TABLE: true,
  DATATABLE: true,
  ...localStorageFeatures,
};

export const dispatchChartEvent = (
  eventType: string,
  el: any,
  payload: object,
) => {
  const eventData = {
    ...payload,
    chartName: '',
    chartId: '',
  };

  const chart = el?.closest('[data-test-chart-name]');
  if (chart) {
    eventData.chartName = chart.getAttribute('data-test-chart-name');
    eventData.chartId = chart.getAttribute('data-test-chart-id');
  }

  console.log(eventType, eventData);
  const chartClickEvent = new CustomEvent(eventType, {
    detail: eventData,
  });
  document.dispatchEvent(chartClickEvent);
};
