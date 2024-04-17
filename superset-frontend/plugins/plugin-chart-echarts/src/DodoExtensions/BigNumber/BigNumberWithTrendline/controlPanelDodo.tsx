import { t } from '@superset-ui/core';

import {
  controlPanelCommonConditionalFormattingMessageRow,
  controlPanelCommonConditionalFormattingRow,
} from '../controlPanelCommon';

const bigNumberWithTrendlineControlPanelConditionalFormatting = {
  label: t('Conditional formatting'),
  expanded: false,
  controlSetRows: [
    [...controlPanelCommonConditionalFormattingRow],
    [
      {
        name: 'comparison_period_conditional_formatting',
        config: {
          type: 'ConditionalFormattingControlDodo',
          renderTrigger: true,
          label: t('Comparison period conditional Formatting'),
          description: t(
            'Apply comporation period conditional color formatting',
          ),
          shouldMapStateToProps() {
            return false;
          },
        },
      },
    ],
    [...controlPanelCommonConditionalFormattingMessageRow],
  ],
};

export { bigNumberWithTrendlineControlPanelConditionalFormatting };
