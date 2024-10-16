import { t } from '@superset-ui/core';
import { sharedControls } from '@superset-ui/chart-controls';

export default {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],  // The metric to be visualized
        ['minVal', 'maxVal'],  // Optional: Controls for setting the min/max values for the speedometer
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['colorScheme'],  // Color scheme options
        ['animation'],  // Add animation option
      ],
    },
  ],
};
