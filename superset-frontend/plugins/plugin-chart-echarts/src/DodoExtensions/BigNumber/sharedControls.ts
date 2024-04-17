// DODO added
import { CustomControlItem } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';
import { AlignmentName, AlignmentValue, ValueToShowEnum } from './types';

// DODO added #32232659
export const conditionalMessageFontSize: CustomControlItem = {
  name: 'conditional_message_font_size',
  config: {
    type: 'SelectControl',
    label: t('Conditional message Font Size'),
    renderTrigger: true,
    clearable: false,
    default: 0.125,
    // Values represent the percentage of space a subheader should take
    options: [
      {
        label: t('Tiny'),
        value: 0.125,
      },
      {
        label: t('Small'),
        value: 0.15,
      },
      {
        label: t('Normal'),
        value: 0.2,
      },
      {
        label: t('Large'),
        value: 0.3,
      },
      {
        label: t('Huge'),
        value: 0.4,
      },
    ],
  },
};

// DODO added #32232659
export const Alignment: CustomControlItem = {
  name: 'alignment',
  config: {
    type: 'SelectControl',
    label: t('Alignment'),
    renderTrigger: true,
    clearable: false,
    default: AlignmentValue.LEFT,
    // Values represent the percentage of space a subheader should take
    options: [
      {
        label: t(AlignmentName.LEFT),
        value: AlignmentValue.LEFT,
      },
      {
        label: t(AlignmentName.CENTER),
        value: AlignmentValue.CENTER,
      },
      {
        label: t(AlignmentName.RIGHT),
        value: AlignmentValue.RIGHT,
      },
    ],
  },
};

// DODO added #32232659
export const ValueToShow: CustomControlItem = {
  name: 'value_to_show',
  config: {
    type: 'SelectControl',
    label: t('Value to show'),
    renderTrigger: true,
    clearable: false,
    default: ValueToShowEnum.OLDEST,
    // Values represent the percentage of space a subheader should take
    options: [
      {
        label: t(ValueToShowEnum.OLDEST),
        value: ValueToShowEnum.OLDEST,
      },
      {
        label: t(ValueToShowEnum.AVERAGE),
        value: ValueToShowEnum.AVERAGE,
      },
      {
        label: t(ValueToShowEnum.LATEST),
        value: ValueToShowEnum.LATEST,
      },
    ],
  },
};
