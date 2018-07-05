export const regionFilterSliceId = 256;
export const countryFilterSliceId = 257;

export const defaultFilters = {
  [regionFilterSliceId]: { region: [] },
  [countryFilterSliceId]: { country_name: ['United States'] },
};

export const regionFilterSlice = {
  datasource: null,
  description: null,
  description_markeddown: '',
  edit_url: '/slicemodelview/edit/regionFilterSliceId',
  form_data: {
    datasource: '2__table',
    date_filter: false,
    filters: [
      {
        col: 'country_name',
        op: 'in',
        val: ['United States', 'France', 'Japan'],
      },
    ],
    granularity_sqla: null,
    groupby: ['region', 'country_name'],
    having: '',
    instant_filtering: true,
    metric: 'sum__SP_POP_TOTL',
    show_druid_time_granularity: false,
    show_druid_time_origin: false,
    show_sqla_time_column: false,
    show_sqla_time_granularity: false,
    since: '100 years ago',
    slice_id: regionFilterSliceId,
    time_grain_sqla: null,
    until: 'now',
    viz_type: 'filter_box',
    where: '',
  },
  slice_id: regionFilterSliceId,
  slice_name: 'Region Filters',
  slice_url: `/superset/explore/table/2/?form_data=%7B%22slice_id%22%3A%20${regionFilterSliceId}%7D`,
  viz_type: 'filter_box',
};

export const countryFilterSlice = {
  datasource: null,
  description: null,
  description_markeddown: '',
  edit_url: '/slicemodelview/edit/countryFilterSliceId',
  form_data: {
    datasource: '2__table',
    date_filter: false,
    filters: [],
    granularity_sqla: null,
    groupby: ['country_name'],
    having: '',
    instant_filtering: true,
    metric: 'sum__SP_POP_TOTL',
    show_druid_time_granularity: false,
    show_druid_time_origin: false,
    show_sqla_time_column: false,
    show_sqla_time_granularity: false,
    since: '100 years ago',
    slice_id: countryFilterSliceId,
    time_grain_sqla: null,
    until: 'now',
    viz_type: 'filter_box',
    where: '',
  },
  slice_id: countryFilterSliceId,
  slice_name: 'Country Filters',
  slice_url: `/superset/explore/table/2/?form_data=%7B%22slice_id%22%3A%20${countryFilterSliceId}%7D`,
  viz_type: 'filter_box',
};
