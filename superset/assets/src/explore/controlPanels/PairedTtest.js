import { t } from '@superset-ui/translation';
import * as sections from './sections';

export default {
  requiresTime: true,
  controlPanelSections: [
    sections.NVD3TimeSeries[0],
    {
      label: t('Paired t-test'),
      expanded: false,
      controlSetRows: [
        ['significance_level'],
        ['pvalue_precision'],
        ['liftvalue_precision'],
      ],
    },
  ],
};
