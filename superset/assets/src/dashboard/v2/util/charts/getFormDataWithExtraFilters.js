import getEffectiveExtraFilters from './getEffectiveExtraFilters';

// We cache formData objects so that our connected container components don't always trigger
// render cascades. we cannot leverage the reselect library because our cache size is >1
const cachedDashboardMetadataByChart = {};
const cachedFiltersByChart = {};
const cachedFormdataByChart = {};

export default function getFormDataWithExtraFilters({
  chart,
  dashboardMetadata,
  filters,
  sliceId,
}) {
  // if dashboard metadata + filters have not changed, use cache if possible
  if (
    cachedDashboardMetadataByChart[sliceId] &&
    cachedDashboardMetadataByChart[sliceId] === dashboardMetadata &&
    cachedFiltersByChart[sliceId] &&
    cachedFiltersByChart[sliceId] === filters &&
    cachedFormdataByChart[sliceId]
  ) {
    return cachedFormdataByChart[sliceId];
  }

  const extraFilters = getEffectiveExtraFilters({
    dashboardMetadata,
    filters,
    sliceId,
  });

  const formData = {
    ...chart.formData,
    extra_filters: [
      ...chart.formData.filters,
      ...extraFilters,
    ],
  };

  cachedDashboardMetadataByChart[sliceId] = dashboardMetadata;
  cachedFiltersByChart[sliceId] = filters;
  cachedFormdataByChart[sliceId] = formData;

  return formData;
}
