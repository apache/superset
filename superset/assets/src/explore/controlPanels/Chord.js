import { t } from '@superset-ui/translation';
import { nonEmpty } from '../validators';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['groupby'],
        ['columns'],
        ['metric'],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['y_axis_format', null],
        ['color_scheme'],
      ],
    },
  ],
  controlOverrides: {
    y_axis_format: {
      label: t('Number format'),
      description: t('Choose a number format'),
    },
    groupby: {
      label: t('Source'),
      multi: false,
      validators: [nonEmpty],
      description: t('Choose a source'),
    },
    columns: {
      label: t('Target'),
      multi: false,
      validators: [nonEmpty],
      description: t('Choose a target'),
    },
  },
};
