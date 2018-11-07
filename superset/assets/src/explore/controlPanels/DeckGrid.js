import { t } from '@superset-ui/translation';
import { nonEmpty } from '../validators';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['spatial', 'size'],
        ['row_limit', 'filter_nulls'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        ['mapbox_style', 'viewport'],
        ['color_picker', 'autozoom'],
        ['grid_size', 'extruded'],
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
    size: {
      label: t('Height'),
      description: t('Metric used to control height'),
      validators: [nonEmpty],
    },
  },
};
