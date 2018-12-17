import { t } from '@superset-ui/translation';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['metric'],
        ['adhoc_filters'],
        ['date_filter', 'instant_filtering'],
        ['show_sqla_time_granularity', 'show_sqla_time_column'],
        ['show_druid_time_granularity', 'show_druid_time_origin'],
      ],
    },
  ],
  controlOverrides: {
    groupby: {
      label: t('Filter controls'),
      description: t(
        'The controls you want to filter on. Note that only columns ' +
        'checked as "filterable" will show up on this list.'),
      mapStateToProps: state => ({
        options: (state.datasource) ? state.datasource.columns.filter(c => c.filterable) : [],
      }),
    },
  },
};
