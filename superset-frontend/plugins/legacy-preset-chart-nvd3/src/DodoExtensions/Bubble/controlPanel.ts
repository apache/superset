import { t } from '@superset-ui/core';
import { D3_FORMAT_DOCS, D3_FORMAT_OPTIONS } from '@superset-ui/chart-controls';

// DODO added #20704667
const bubbleCustomize = {
  label: t('Bubble'),
  expanded: true,
  controlSetRows: [
    [
      {
        name: 'bubble_size_format',
        config: {
          type: 'SelectControl',
          freeForm: true,
          label: t('Bubble size value format'),
          renderTrigger: true,
          description: D3_FORMAT_DOCS,
          default: 'SMART_NUMBER',
          choices: D3_FORMAT_OPTIONS,
        },
      },
    ],
  ],
};

export { bubbleCustomize };
