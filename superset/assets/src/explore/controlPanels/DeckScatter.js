import { t } from '@superset-ui/translation';
import timeGrainSqlaAnimationOverrides from './timeGrainSqlaAnimationOverrides';

export default {
  requiresTime: true,
  onInit: controlState => ({
    ...controlState,
    time_grain_sqla: {
      ...controlState.time_grain_sqla,
      value: null,
    },
    granularity: {
      ...controlState.granularity,
      value: null,
    },
  }),
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['spatial', null],
        ['row_limit', 'filter_nulls'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        ['autozoom', null],
      ],
    },
    {
      label: t('Point Size'),
      controlSetRows: [
        ['point_radius_fixed', 'point_unit'],
        ['min_radius', 'max_radius'],
        ['multiplier', null],
      ],
    },
    {
      label: t('Point Color'),
      controlSetRows: [
        ['color_picker', 'legend_position'],
        ['dimension', 'color_scheme'],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        ['js_columns'],
        ['js_data_mutator'],
        ['js_tooltip'],
        ['js_onclick_href'],
      ],
    },
  ],
  controlOverrides: {
    dimension: {
      label: t('Categorical Color'),
      description: t('Pick a dimension from which categorical colors are defined'),
    },
    size: {
      validators: [],
    },
    time_grain_sqla: timeGrainSqlaAnimationOverrides,
  },
};
