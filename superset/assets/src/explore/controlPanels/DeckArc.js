import { t } from '@superset-ui/translation';
import timeGrainSqlaAnimationOverrides from './timeGrainSqlaAnimationOverrides';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['start_spatial', 'end_spatial'],
        ['row_limit', 'filter_nulls'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        ['autozoom', null],
      ],
    },
    {
      label: t('Arc'),
      controlSetRows: [
        ['color_picker', 'target_color_picker'],
        ['dimension', 'color_scheme'],
        ['stroke_width', 'legend_position'],
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
