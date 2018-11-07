import { t } from '@superset-ui/translation';
import * as sections from './sections';

export default {
  controlPanelSections: [
    sections.NVD3TimeSeries[0],
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['series_height', 'horizon_color_scale'],
      ],
    },
  ],
};
