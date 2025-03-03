// DODO was here
// DODO created 45525377

import { t } from '@superset-ui/core';
import {
  controlPanelCommonConditionalFormattingMessageRow,
  controlPanelCommonConditionalFormattingRow,
} from '../controlPanelCommon';

const BigNumberControlPanelConditionalFormatting = {
  label: t('Conditional formatting'),
  expanded: false,
  controlSetRows: [
    [...controlPanelCommonConditionalFormattingRow],
    [...controlPanelCommonConditionalFormattingMessageRow],
  ],
};

export { BigNumberControlPanelConditionalFormatting };
