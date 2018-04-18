export default function getEffectiveExtraFilters({
  dashboardMetadata,
  filters,
  sliceId,
}) {
  const immuneSlices = dashboardMetadata.filter_immune_slices || [];

  const effectiveFilters = [];

  if (sliceId && immuneSlices.includes(sliceId)) {
    // The slice is immune to dashboard filters
    return effectiveFilters;
  }

  // Build a list of fields the slice is immune to filters on
  let immuneToFields = [];
  if (
    sliceId &&
    dashboardMetadata.filter_immune_slice_fields &&
    dashboardMetadata.filter_immune_slice_fields[sliceId]) {
    immuneToFields = dashboardMetadata.filter_immune_slice_fields[sliceId];
  }

  Object.keys(filters).forEach((filteringSliceId) => {
    if (filteringSliceId === sliceId.toString()) {
      // Filters applied by the slice don't apply to itself
      return;
    }
    Object.keys(filters[filteringSliceId]).forEach((field) => {
      if (!immuneToFields.includes(field)) {
        effectiveFilters.push({
          col: field,
          op: 'in',
          val: filters[filteringSliceId][field],
        });
      }
    });
  });

  return effectiveFilters;
}
