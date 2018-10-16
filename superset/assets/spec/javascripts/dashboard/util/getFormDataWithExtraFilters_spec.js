import getFormDataWithExtraFilters from '../../../../src/dashboard/util/charts/getFormDataWithExtraFilters';

describe('getFormDataWithExtraFilters', () => {
  const chartId = 'chartId';
  const mockArgs = {
    chart: {
      id: chartId,
      formData: {
        filters: [
          {
            col: 'country_name',
            op: 'in',
            val: ['United States'],
          },
        ],
      },
    },
    dashboardMetadata: {
      filter_immune_slices: [],
      filter_immune_slice_fields: {},
    },
    filters: {
      filterId: {
        region: ['Spain'],
        color: ['pink', 'purple'],
      },
    },
    sliceId: chartId,
  };

  it('should include filters from the passed filters', () => {
    const result = getFormDataWithExtraFilters(mockArgs);
    expect(result.extra_filters).toHaveLength(2);
    expect(result.extra_filters[0]).toEqual({
      col: 'region',
      op: 'in',
      val: ['Spain'],
    });
    expect(result.extra_filters[1]).toEqual({
      col: 'color',
      op: 'in',
      val: ['pink', 'purple'],
    });
  });

  it('should not add additional filters if the slice is immune to them', () => {
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      dashboardMetadata: {
        filter_immune_slices: [chartId],
      },
    });
    expect(result.extra_filters).toHaveLength(0);
  });

  it('should not add additional filters for fields to which the slice is immune', () => {
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      dashboardMetadata: {
        filter_immune_slice_fields: {
          [chartId]: ['region'],
        },
      },
    });
    expect(result.extra_filters).toHaveLength(1);
  });
});
