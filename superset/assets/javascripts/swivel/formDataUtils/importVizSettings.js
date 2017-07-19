/* eslint camelcase: 0 */
export function importFormData(vizSettingsStore, formData) {
  const store = vizSettingsStore;
  store.showLegend = formData.show_legend;
  store.separateCharts = formData.separate_charts;
  return store;
}
