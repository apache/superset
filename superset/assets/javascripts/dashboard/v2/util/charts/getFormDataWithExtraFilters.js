import getEffectiveExtraFilters from './getEffectiveExtraFilters';

// We cache formData objects so that our connected container components don't always trigger
// render cascades. we cannot leverage the reselect library because our cache size is >1
let cachedMetadata = null;
let cachedFormdata = {};

export default function getFormDataWithExtraFilters({
  chart,
  dashboardMetadata,
  filters,
  sliceId,
}) {
  // dashboard metadata has not changed use cache if possible
  if (cachedMetadata === dashboardMetadata && cachedFormdata[sliceId]) {
    return cachedFormdata[sliceId];
  } else if (cachedMetadata !== dashboardMetadata) {
    // changes to dashboardMetadata should invalidate all caches
    cachedMetadata = dashboardMetadata;
    cachedFormdata = {};
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

  cachedFormdata[sliceId] = formData;

  return formData;
}
